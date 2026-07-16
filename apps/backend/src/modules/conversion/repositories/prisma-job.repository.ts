import type { Prisma } from '@prisma/client'
import { join } from 'node:path'
import { appendFile } from 'node:fs/promises'
import { prisma } from '../../../shared/database/prisma'
import { mkdirp } from '../../../shared/utils/filesystem'
import { env } from '../../../shared/config/env'
import type { ConversionJobRepository } from './conversion-job.repository'
import type {
  ConversionJobConfig,
  ConversionJobStatus,
  ConversionJobState,
  JobStatus,
  ConversionOutput,
  CoverRef,
  ErrorHandlingStrategy,
} from '../types/conversion.types'

export class PrismaJobRepository implements ConversionJobRepository {
  async create(job: ConversionJobState): Promise<void> {
    const convId = job.config.conversionId

    const conv = await prisma.conversion.findUnique({
      where: { conversionId: convId },
      select: { id: true },
    })

    if (!conv) {
      console.error(`[PrismaJobRepository] Conversion "${convId}" não encontrada no banco — job ${job.jobId} não será criado.`)
      return
    }

    const config = job.config

    await prisma.conversionJob.create({
      data: {
        jobId: job.jobId,
        conversionId: conv.id,
        sourceId: config.sourceId,
        bookIndex: config.bookIndex,
        chapters: config.chapters as Prisma.InputJsonValue,
        cover: config.cover as Prisma.InputJsonValue,
        output: config.output as unknown as Prisma.InputJsonValue,
        metadata: config.metadata as unknown as Prisma.InputJsonValue,
        options: config.options as Prisma.InputJsonValue,
        errorHandlingStrategy: config.errorHandlingStrategy,
        status: job.status,
        progress: job.progress,
        currentStep: job.currentStep,
        downloadedImages: job.downloadedImages,
        totalImages: job.totalImages,
      },
    })

    await this.appendLog(job.jobId, `Job criado com status "${job.status}"`)
  }

  async findById(jobId: string): Promise<ConversionJobState | null> {
    const row = await prisma.conversionJob.findUnique({
      where: { jobId },
      include: {
        conversion: { select: { conversionId: true } },
      },
    })

    if (!row) return null

    return this.toState(row)
  }

  async update(jobId: string, updates: Partial<ConversionJobStatus>): Promise<void> {
    const data: Record<string, unknown> = {}

    if (updates.status !== undefined) data.status = updates.status
    if (updates.progress !== undefined) data.progress = updates.progress
    if (updates.currentStep !== undefined) data.currentStep = updates.currentStep
    if (updates.downloadedImages !== undefined) data.downloadedImages = updates.downloadedImages
    if (updates.totalImages !== undefined) data.totalImages = updates.totalImages
    if (updates.error !== undefined) data.error = updates.error
    if (updates.downloadUrl !== undefined) data.downloadUrl = updates.downloadUrl
    if (updates.outputFile !== undefined) data.outputFile = updates.outputFile
    if (updates.outputSize !== undefined) data.outputSize = updates.outputSize
    if (updates.completedAt !== undefined) data.completedAt = updates.completedAt ? new Date(updates.completedAt) : null

    if (Object.keys(data).length === 0) return

    await prisma.conversionJob.update({
      where: { jobId },
      data,
    })
  }

  async delete(jobId: string): Promise<void> {
    try {
      await prisma.conversionJob.delete({ where: { jobId } })
    } catch {
      // melhor-esforço
    }
  }

  async appendLog(jobId: string, message: string): Promise<void> {
    try {
      const row = await prisma.conversionJob.findUnique({
        where: { jobId },
        select: {
          conversion: { select: { conversionId: true } },
        },
      })

      if (!row) return

      const logDir = join(
        env.CONVERSIONS_STORAGE_PATH,
        row.conversion.conversionId,
        'jobs',
        jobId,
        'logs',
      )
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

  private toState(row: Record<string, unknown>): ConversionJobState {
    const r = row as Record<string, any>
    const conv = r.conversion as { conversionId: string }

    const config: ConversionJobConfig = {
      conversionId: conv.conversionId,
      jobId: r.jobId as string,
      bookIndex: r.bookIndex as number,
      sourceId: r.sourceId as string,
      chapters: r.chapters as unknown as string[],
      cover: r.cover as unknown as CoverRef,
      output: r.output as unknown as ConversionOutput,
      metadata: r.metadata as unknown as { title: string; author?: string },
      options: r.options as unknown as Record<string, string | number | boolean | undefined>,
      errorHandlingStrategy: (r.errorHandlingStrategy ?? undefined) as ErrorHandlingStrategy | undefined,
    }

    const status: ConversionJobStatus = {
      jobId: r.jobId as string,
      status: r.status as JobStatus,
      progress: r.progress as number,
      currentStep: r.currentStep as string,
      downloadedImages: r.downloadedImages as number,
      totalImages: r.totalImages as number,
      createdAt: (r.createdAt as Date).toISOString(),
      updatedAt: (r.updatedAt as Date).toISOString(),
      completedAt: r.completedAt ? (r.completedAt as Date).toISOString() : undefined,
      error: (r.error as string | null) ?? undefined,
      downloadUrl: (r.downloadUrl as string | null) ?? undefined,
      outputFile: (r.outputFile as string | null) ?? undefined,
      outputSize: r.outputSize ? Number(r.outputSize) : undefined,
    }

    return { ...status, config }
  }
}
