import { mkdirp, writeJson, readJson, pathExists } from '../../../shared/utils/filesystem'
import { join } from 'node:path'
import { appendFile } from 'node:fs/promises'
import type { ConversionJobConfig, ConversionJobStatus, ConversionJobState } from '../types/conversion.types'
import type { ConversionJobRepository } from './conversion-job.repository'
import { env } from '../../../shared/config/env'

/**
 * Repositório de Jobs em filesystem.
 *
 * Cada Job vive em `{CONVERSIONS_STORAGE_PATH}/{conversionId}/jobs/{jobId}/`.
 * O `conversionId` é injetado no construtor (escopo por Conversion); caso
 * omitido, assume `CONVERSIONS_STORAGE_PATH` como basePath (legado).
 */
export class FilesystemJobRepository implements ConversionJobRepository {
  private readonly basePath: string

  constructor(conversionId?: string, rootPath?: string) {
    const root = rootPath ?? env.CONVERSIONS_STORAGE_PATH
    this.basePath = conversionId
      ? join(root, conversionId, 'jobs')
      : root
  }

  private jobDir(jobId: string): string {
    return join(this.basePath, jobId)
  }

  private configPath(jobId: string): string {
    return join(this.basePath, jobId, 'config.json')
  }

  private statusPath(jobId: string): string {
    return join(this.basePath, jobId, 'status.json')
  }

  private logPath(jobId: string): string {
    return join(this.basePath, jobId, 'logs', 'conversion.log')
  }

  /**
   * Cria o job completo:
   * - Diretórios: logs/, temp/, output/
   * - config.json (imutável)
   * - status.json (mutável)
   */
  async create(job: ConversionJobState): Promise<void> {
    const dir = this.jobDir(job.jobId)

    await mkdirp(join(dir, 'logs'))
    await mkdirp(join(dir, 'temp'))
    await mkdirp(join(dir, 'output'))

    const config: ConversionJobConfig = job.config

    const status: ConversionJobStatus = {
      jobId: job.jobId,
      status: job.status,
      progress: job.progress,
      currentStep: job.currentStep,
      downloadedImages: job.downloadedImages,
      totalImages: job.totalImages,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      completedAt: job.completedAt,
      downloadUrl: job.downloadUrl,
      outputFile: job.outputFile,
      outputSize: job.outputSize,
      error: job.error,
    }

    await writeJson(this.configPath(job.jobId), config)
    await writeJson(this.statusPath(job.jobId), status)

    await this.appendLog(job.jobId, `Job criado com status "${job.status}"`)
  }

  /**
   * Lê config.json + status.json e retorna a visão unificada.
   */
  async findById(jobId: string): Promise<ConversionJobState | null> {
    const configExists = await pathExists(this.configPath(jobId))
    const statusExists = await pathExists(this.statusPath(jobId))

    if (!configExists || !statusExists) {
      return null
    }

    const config = await readJson<ConversionJobConfig>(this.configPath(jobId))
    const status = await readJson<ConversionJobStatus>(this.statusPath(jobId))

    if (!config || !status) return null

    return { ...status, config }
  }

  /**
   * Atualiza APENAS o status.json. O config.json nunca é modificado.
   */
  async update(jobId: string, updates: Partial<ConversionJobStatus>): Promise<void> {
    const existing = await readJson<ConversionJobStatus>(this.statusPath(jobId))
    if (!existing) return
    const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() }
    await writeJson(this.statusPath(jobId), updated)
  }

  async delete(jobId: string): Promise<void> {
    const { rm } = await import('node:fs/promises')
    const dir = this.jobDir(jobId)
    const exists = await pathExists(dir)
    if (exists) {
      await rm(dir, { recursive: true, force: true })
    }
  }

  /**
   * Adiciona uma linha de log timestamped ao arquivo logs/conversion.log.
   */
  async appendLog(jobId: string, message: string): Promise<void> {
    try {
      const logDir = join(this.jobDir(jobId), 'logs')
      await mkdirp(logDir)
      const timestamp = new Date().toISOString()
      await appendFile(this.logPath(jobId), `[${timestamp}] ${message}\n`, 'utf-8')
    } catch {
      // Logs são melhor-esforço — não falha o job
    }
  }

  withConversion(conversionId: string): ConversionJobRepository {
    return new FilesystemJobRepository(conversionId)
  }
}