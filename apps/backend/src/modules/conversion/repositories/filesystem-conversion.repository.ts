import { mkdirp, writeJson, readJson, pathExists } from '../../../shared/utils/filesystem'
import { join } from 'node:path'
import { appendFile, readdir } from 'node:fs/promises'
import type {
  ConversionConfig,
  ConversionStatusFile,
  ConversionState,
  ConversionJobSummary,
  ConversionStatus,
} from '../types/conversion.types'
import type { ConversionRepository } from './conversion.repository'
import { env } from '../../../shared/config/env'

/**
 * Persistência de Conversion em filesystem.
 *
 * Layout:
 *   storage/conversions/{conversionId}/
 *     ├─ config.json   (imutável — snapshot da requisição do usuário)
 *     ├─ status.json   (mutável — status agregado, mantido em sync com os Jobs)
 *     ├─ logs/conversion.log
 *     └─ jobs/
 *         ├─ job_001/
 *         │   ├─ config.json
 *         │   ├─ status.json
 *         │   ├─ logs/
 *         │   └─ output/   (EPUB do Job)
 *         └─ job_002/...
 */
export class FilesystemConversionRepository implements ConversionRepository {
  private readonly basePath: string

  constructor(basePath?: string) {
    this.basePath = basePath ?? env.CONVERSIONS_STORAGE_PATH
  }

  private convDir(conversionId: string): string {
    return join(this.basePath, conversionId)
  }

  private configPath(conversionId: string): string {
    return join(this.basePath, conversionId, 'config.json')
  }

  private statusPath(conversionId: string): string {
    return join(this.basePath, conversionId, 'status.json')
  }

  private logPath(conversionId: string): string {
    return join(this.basePath, conversionId, 'logs', 'conversion.log')
  }

  private jobsPath(conversionId: string): string {
    return join(this.basePath, conversionId, 'jobs')
  }

  async create(state: ConversionState): Promise<void> {
    const dir = this.convDir(state.conversionId)

    await mkdirp(join(dir, 'logs'))
    await mkdirp(this.jobsPath(state.conversionId))

    const config: ConversionConfig = state.config

    const status: ConversionStatusFile = {
      conversionId: state.conversionId,
      status: state.status,
      progress: state.progress,
      totalJobs: state.totalJobs,
      completedJobs: state.completedJobs,
      failedJobs: state.failedJobs,
      runningJobs: state.runningJobs,
      pendingJobs: state.pendingJobs,
      createdAt: state.createdAt,
      updatedAt: state.updatedAt,
      completedAt: state.completedAt,
      finishedAt: state.finishedAt,
      error: state.error,
      jobs: state.jobs,
    }

    await writeJson(this.configPath(state.conversionId), config)
    await writeJson(this.statusPath(state.conversionId), status)

    await this.appendLog(state.conversionId, `Conversion criada com ${state.totalJobs} job(s)`)
  }

  async findById(conversionId: string): Promise<ConversionState | null> {
    const configExists = await pathExists(this.configPath(conversionId))
    const statusExists = await pathExists(this.statusPath(conversionId))

    if (!configExists || !statusExists) return null

    const config = await readJson<ConversionConfig>(this.configPath(conversionId))
    const status = await readJson<ConversionStatusFile>(this.statusPath(conversionId))

    if (!config || !status) return null

    return { ...status, config }
  }

  async update(conversionId: string, updates: Partial<ConversionStatusFile>): Promise<void> {
    const existing = await readJson<ConversionStatusFile>(this.statusPath(conversionId))
    if (!existing) return
    const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() }
    await writeJson(this.statusPath(conversionId), updated)
  }

  /**
   * Recomputa o status agregado da Conversion lendo todos os status.json
   * dos Jobs em disco. Atualiza: status, progress, completedJobs, failedJobs,
   * runningJobs, pendingJobs, jobs[], updatedAt, e finishedAt (se terminal).
   */
  async syncStatus(conversionId: string): Promise<ConversionState | null> {
    const config = await readJson<ConversionConfig>(this.configPath(conversionId))
    if (!config) return null

    const jobIds = await this.listJobIds(conversionId)
    const summaries: ConversionJobSummary[] = []

    for (const jobId of jobIds) {
      const jobDir = join(this.basePath, conversionId, 'jobs', jobId)
      const statusPath = join(jobDir, 'status.json')
      const configPath = join(jobDir, 'config.json')

      if (!(await pathExists(statusPath)) || !(await pathExists(configPath))) continue

      const jobStatus = await readJson<{
        status: ConversionJobSummary['status']
        progress: number
        outputFile?: string
        outputSize?: number
        downloadUrl?: string
        error?: string
      }>(statusPath)
      const jobConfig = await readJson<{
        bookIndex: number
        metadata: { title: string }
      }>(configPath)
      if (!jobStatus || !jobConfig) continue

      summaries.push({
        jobId,
        index: jobConfig.bookIndex,
        title: jobConfig.metadata?.title ?? '',
        status: jobStatus.status,
        progress: jobStatus.progress,
        outputFile: jobStatus.outputFile,
        outputSize: jobStatus.outputSize,
        downloadUrl: jobStatus.downloadUrl,
        error: jobStatus.error,
      })
    }

    summaries.sort((a, b) => a.index - b.index)

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
      : Math.round((summaries.reduce((acc, s) => acc + s.progress, 0) / totalJobs))

    const now = new Date().toISOString()
    const isTerminal = ['completed', 'failed', 'cancelled'].includes(aggregateStatus)

    const updated: Partial<ConversionStatusFile> = {
      status: aggregateStatus,
      progress,
      totalJobs,
      completedJobs,
      failedJobs,
      runningJobs,
      pendingJobs,
      jobs: summaries,
      updatedAt: now,
      ...(isTerminal ? { finishedAt: now } : {}),
    }

    await this.update(conversionId, updated)

    return this.findById(conversionId)
  }

  async listJobIds(conversionId: string): Promise<string[]> {
    const jobsDir = this.jobsPath(conversionId)
    if (!(await pathExists(jobsDir))) return []
    try {
      const entries = await readdir(jobsDir, { withFileTypes: true })
      return entries.filter((e) => e.isDirectory()).map((e) => e.name)
    } catch {
      return []
    }
  }

  async appendLog(conversionId: string, message: string): Promise<void> {
    try {
      const logDir = join(this.convDir(conversionId), 'logs')
      await mkdirp(logDir)
      const timestamp = new Date().toISOString()
      await appendFile(this.logPath(conversionId), `[${timestamp}] ${message}\n`, 'utf-8')
    } catch {
      // melhor-esforço
    }
  }

  async delete(conversionId: string): Promise<void> {
    const { rm } = await import('node:fs/promises')
    const dir = this.convDir(conversionId)
    const exists = await pathExists(dir)
    if (exists) {
      await rm(dir, { recursive: true, force: true })
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
    const active = ['preparing', 'downloading', 'converting', 'packaging']
    if (summaries.some((s) => active.includes(s.status))) return 'processing'
    return 'queued'
  }
}