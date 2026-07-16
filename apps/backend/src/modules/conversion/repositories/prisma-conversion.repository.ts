import type { Prisma } from '@prisma/client'
import { join } from 'node:path'
import { appendFile } from 'node:fs/promises'
import { prisma } from '../../../shared/database/prisma'
import { mkdirp } from '../../../shared/utils/filesystem'
import { env } from '../../../shared/config/env'
import { JobLiveStatusStore } from '../../../shared/redis/job-status-store'
import type { ConversionRepository } from './conversion.repository'
import type {
  ConversionConfig,
  ConversionStatusFile,
  ConversionState,
  ConversionJobSummary,
  ConversionStatus,
  JobStatus,
  ConversionMetadata,
  ConversionOutput,
  Book,
  CoverRef,
  ErrorHandlingStrategy,
  ConversionListFilters,
  ConversionListPagination,
  ConversionListResult,
  ConversionSummary,
} from '../types/conversion.types'

export class PrismaConversionRepository implements ConversionRepository {
  async create(state: ConversionState): Promise<void> {
    await prisma.conversion.create({
      data: {
        conversionId: state.conversionId,
        userId: state.config.userId,
        sourceId: state.config.sourceId,
        cover: state.config.cover as Prisma.InputJsonValue,
        output: state.config.output as unknown as Prisma.InputJsonValue,
        metadata: state.config.metadata as Prisma.InputJsonValue,
        books: state.config.books as unknown as Prisma.InputJsonValue,
        options: state.config.options as Prisma.InputJsonValue,
        errorHandlingStrategy: state.config.errorHandlingStrategy,
        status: state.status,
        progress: state.progress,
        totalJobs: state.totalJobs,
        completedJobs: state.completedJobs,
        failedJobs: state.failedJobs,
        runningJobs: state.runningJobs,
        pendingJobs: state.pendingJobs,
        error: state.error,
      },
    })

    await this.appendLog(state.conversionId, `Conversion criada com ${state.totalJobs} job(s)`)
  }

  async findById(conversionId: string): Promise<ConversionState | null> {
    const row = await prisma.conversion.findUnique({
      where: { conversionId },
      include: {
        jobs: { orderBy: { bookIndex: 'asc' } },
      },
    })

    if (!row) return null

    return this.toState(row)
  }

  async listByUser(
    userId: string,
    filters: ConversionListFilters,
    pagination: ConversionListPagination,
  ): Promise<ConversionListResult> {
    const where: Prisma.ConversionWhereInput = { userId }

    if (filters.status) {
      where.status = filters.status
    }
    if (filters.sourceId) {
      where.sourceId = filters.sourceId
    }

    const { page, limit } = pagination
    const skip = (page - 1) * limit

    const [rows, total] = await Promise.all([
      prisma.conversion.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          conversionId: true,
          sourceId: true,
          metadata: true,
          status: true,
          progress: true,
          totalJobs: true,
          completedJobs: true,
          failedJobs: true,
          createdAt: true,
          updatedAt: true,
          finishedAt: true,
        },
      }),
      prisma.conversion.count({ where }),
    ])

    const items: ConversionSummary[] = rows.map((row) => ({
      conversionId: row.conversionId,
      sourceId: row.sourceId,
      title: (row.metadata as unknown as { title?: string })?.title ?? '',
      status: row.status as ConversionStatus,
      progress: row.progress,
      totalJobs: row.totalJobs,
      completedJobs: row.completedJobs,
      failedJobs: row.failedJobs,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      finishedAt: row.finishedAt?.toISOString(),
    }))

    return { items, total, page, limit }
  }

  async update(conversionId: string, updates: Partial<ConversionStatusFile>): Promise<void> {
    const data: Record<string, unknown> = {}

    if (updates.status !== undefined) data.status = updates.status
    if (updates.progress !== undefined) data.progress = updates.progress
    if (updates.totalJobs !== undefined) data.totalJobs = updates.totalJobs
    if (updates.completedJobs !== undefined) data.completedJobs = updates.completedJobs
    if (updates.failedJobs !== undefined) data.failedJobs = updates.failedJobs
    if (updates.runningJobs !== undefined) data.runningJobs = updates.runningJobs
    if (updates.pendingJobs !== undefined) data.pendingJobs = updates.pendingJobs
    if (updates.error !== undefined) data.error = updates.error
    if (updates.completedAt !== undefined) data.completedAt = updates.completedAt ? new Date(updates.completedAt) : null
    if (updates.finishedAt !== undefined) data.finishedAt = updates.finishedAt ? new Date(updates.finishedAt) : null

    if (Object.keys(data).length === 0) return

    await prisma.conversion.update({
      where: { conversionId },
      data,
    })
  }

  async syncStatus(conversionId: string): Promise<ConversionState | null> {
    const conv = await prisma.conversion.findUnique({
      where: { conversionId },
      select: { id: true, conversionId: true },
    })

    if (!conv) return null

    const jobs = await prisma.conversionJob.findMany({
      where: { conversionId: conv.id },
      orderBy: { bookIndex: 'asc' },
      select: {
        jobId: true,
        bookIndex: true,
        status: true,
        progress: true,
        outputFile: true,
        outputSize: true,
        downloadUrl: true,
        error: true,
        metadata: true,
      },
    })

    const store = new JobLiveStatusStore()
    const terminalStatuses: JobStatus[] = ['completed', 'failed', 'cancelled']

    const summaries: ConversionJobSummary[] = await Promise.all(
      jobs.map(async (j) => {
        const isTerminal = terminalStatuses.includes(j.status as JobStatus)
        let status = j.status as ConversionJobSummary['status']
        let progress = j.progress
        let outputFile = j.outputFile ?? undefined
        let outputSizeNum = j.outputSize ? Number(j.outputSize) : undefined
        let downloadUrl = j.downloadUrl ?? undefined
        let error = j.error ?? undefined

        if (!isTerminal) {
          const live = await store.get(j.jobId)
          if (live) {
            status = live.status
            progress = live.progress
            outputFile = live.outputFile ?? outputFile
            outputSizeNum = live.outputSize ?? outputSizeNum
            downloadUrl = live.downloadUrl ?? downloadUrl
            error = live.error ?? error
          }
        }

        return {
          jobId: j.jobId,
          index: j.bookIndex,
          title: (j.metadata as unknown as { title?: string })?.title ?? '',
          status,
          progress,
          outputFile,
          outputSize: outputSizeNum,
          downloadUrl,
          error,
        }
      }),
    )

    const totalJobs = summaries.length
    const completedJobs = summaries.filter((s) => s.status === 'completed').length
    const failedJobs = summaries.filter((s) => s.status === 'failed' || s.status === 'cancelled').length
    const runningJobs = summaries.filter((s) =>
      ['preparing', 'downloading', 'converting', 'packaging'].includes(s.status),
    ).length
    const pendingJobs = summaries.filter((s) => s.status === 'queued').length
    const aggregateStatus = this.computeAggregateStatus(summaries)
    const progress = totalJobs === 0
      ? 0
      : Math.round(summaries.reduce((acc, s) => acc + s.progress, 0) / totalJobs)

    const now = new Date()
    const isTerminalConv = ['completed', 'failed', 'cancelled'].includes(aggregateStatus)

    await prisma.conversion.update({
      where: { conversionId },
      data: {
        status: aggregateStatus,
        progress,
        totalJobs,
        completedJobs,
        failedJobs,
        runningJobs,
        pendingJobs,
        ...(isTerminalConv ? { finishedAt: now } : {}),
      },
    })

    const state = await this.findById(conversionId)
    if (!state) return null

    for (const job of state.jobs) {
      if (!terminalStatuses.includes(job.status)) {
        const summary = summaries.find((s) => s.jobId === job.jobId)
        if (summary) {
          job.status = summary.status
          job.progress = summary.progress
          job.outputFile = summary.outputFile ?? job.outputFile
          job.outputSize = summary.outputSize ?? job.outputSize
          job.downloadUrl = summary.downloadUrl ?? job.downloadUrl
          job.error = summary.error ?? job.error
        }
      }
    }

    return state
  }

  async listJobIds(conversionId: string): Promise<string[]> {
    const conv = await prisma.conversion.findUnique({
      where: { conversionId },
      select: { id: true },
    })

    if (!conv) return []

    const jobs = await prisma.conversionJob.findMany({
      where: { conversionId: conv.id },
      select: { jobId: true },
    })

    return jobs.map((j) => j.jobId)
  }

  async appendLog(conversionId: string, message: string): Promise<void> {
    try {
      const logDir = join(env.CONVERSIONS_STORAGE_PATH, conversionId, 'logs')
      await mkdirp(logDir)
      const timestamp = new Date().toISOString()
      await appendFile(
        join(logDir, 'conversion.log'),
        `[${timestamp}] ${message}\n`,
        'utf-8',
      )
    } catch {
      // melhor-esforço
    }
  }

  async delete(conversionId: string): Promise<void> {
    try {
      await prisma.conversion.delete({ where: { conversionId } })
    } catch {
      // Silently ignore se já deletado (cascade nos Jobs)
    }
  }

  private toState(row: {
    conversionId: string
    status: string
    progress: number
    totalJobs: number
    completedJobs: number
    failedJobs: number
    runningJobs: number
    pendingJobs: number
    error: string | null
    createdAt: Date
    updatedAt: Date
    completedAt: Date | null
    finishedAt: Date | null
    userId: string
    sourceId: string
    cover: Prisma.JsonValue
    output: Prisma.JsonValue
    metadata: Prisma.JsonValue
    books: Prisma.JsonValue
    options: Prisma.JsonValue
    errorHandlingStrategy: string | null
    jobs: Array<{
      jobId: string
      bookIndex: number
      status: string
      progress: number
      outputFile: string | null
      outputSize: bigint | null
      downloadUrl: string | null
      error: string | null
      metadata: Prisma.JsonValue
    }>
  }): ConversionState {
    const config: ConversionConfig = {
      sourceId: row.sourceId,
      cover: row.cover as unknown as CoverRef,
      output: row.output as unknown as ConversionOutput,
      metadata: row.metadata as unknown as ConversionMetadata,
      books: row.books as unknown as Book[],
      options: row.options as unknown as Record<string, string | number | boolean | undefined>,
      errorHandlingStrategy: (row.errorHandlingStrategy ?? undefined) as ErrorHandlingStrategy | undefined,
      userId: row.userId,
    }

    const jobs: ConversionJobSummary[] = row.jobs.map((j) => ({
      jobId: j.jobId,
      index: j.bookIndex,
      title: (j.metadata as unknown as { title?: string })?.title ?? '',
      status: j.status as ConversionJobSummary['status'],
      progress: j.progress,
      outputFile: j.outputFile ?? undefined,
      outputSize: j.outputSize ? Number(j.outputSize) : undefined,
      downloadUrl: j.downloadUrl ?? undefined,
      error: j.error ?? undefined,
    }))

    return {
      conversionId: row.conversionId,
      status: row.status as ConversionStatus,
      progress: row.progress,
      totalJobs: row.totalJobs,
      completedJobs: row.completedJobs,
      failedJobs: row.failedJobs,
      runningJobs: row.runningJobs,
      pendingJobs: row.pendingJobs,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      completedAt: row.completedAt?.toISOString(),
      finishedAt: row.finishedAt?.toISOString(),
      error: row.error ?? undefined,
      jobs,
      config,
    }
  }

  private computeAggregateStatus(summaries: ConversionJobSummary[]): ConversionStatus {
    if (summaries.length === 0) return 'queued'
    if (summaries.every((s) => s.status === 'completed')) return 'completed'
    if (summaries.every((s) => s.status === 'cancelled')) return 'cancelled'
    if (summaries.every((s) => s.status === 'failed')) return 'failed'
    if (
      summaries.some(
        (s) => s.status === 'completed' || s.status === 'failed' || s.status === 'cancelled',
      )
    ) {
      return 'partial'
    }
    const active: string[] = ['preparing', 'downloading', 'converting', 'packaging']
    if (summaries.some((s) => active.includes(s.status))) return 'processing'
    return 'queued'
  }
}
