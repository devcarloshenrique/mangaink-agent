import type { ConversionRepository } from '../repositories/conversion.repository'
import type { ConversionJobRepository } from '../repositories/conversion-job.repository'
import type { MobiPreviewService } from '../services/mobi-preview.service'
import type { MobiPreviewStatusStore } from '../../../shared/redis/mobi-preview-status-store'
import type {
  MobiPreviewStartResponse,
  MobiPreviewStatusResponse,
  MobiPreviewIndex,
} from '../types/mobi-preview.types'
import {
  ConversionNotFoundError,
  ForbiddenError,
} from '../errors/conversion.errors'
import { NotAMobiJobError } from '../errors/mobi-preview.errors'

/**
 * Dados enfileirados no BullMQ para extracao de preview MOBI.
 */
export interface MobiPreviewJobData {
  conversionId: string
  jobId: string
  outputFile: string
}

/**
 * Abstracao da fila BullMQ injetada no use-case (para testes).
 */
export interface MobiPreviewQueue {
  enqueue(data: MobiPreviewJobData): Promise<unknown>
}

const ACCEPTED_MOBI_STAGES = new Set(['queued', 'extracting', 'ready', 'failed'])

function isSupportedPreviewFile(filename: string | undefined): boolean {
  if (!filename) return false
  const lower = filename.toLowerCase()
  return lower.endsWith('.mobi') || lower.endsWith('.pdf')
}

async function assertAuthorizedJob(
  conversions: ConversionRepository,
  jobs: ConversionJobRepository,
  conversionId: string,
  jobId: string,
  userId: string,
) {
  const conversion = await conversions.findById(conversionId)
  if (!conversion) throw new ConversionNotFoundError(conversionId)
  if (conversion.config.userId !== userId) throw new ForbiddenError(conversionId)

  const job = await jobs.findById(jobId)
  if (!job) throw new ConversionNotFoundError(jobId)

  if (!isSupportedPreviewFile(job.outputFile)) {
    throw new NotAMobiJobError(
      jobId,
      job.outputFile ? job.outputFile.split('.').pop() ?? '' : 'none',
    )
  }
  return { conversion, job }
}

/**
 * POST /preview — idempotente.
 * - Cache valido: retorna { status:'ready', totalPages, cached:true } sem enfileirar.
 * - Job ja em curso (store com queued/extracting): retorna { processing } sem reenfileirar.
 * - Caso contrario: enfileira no BullMQ e marca status='queued' no Redis Hash.
 */
export class StartMobiPreviewUseCase {
  constructor(
    private readonly conversions: ConversionRepository,
    private readonly jobs: ConversionJobRepository,
    private readonly service: MobiPreviewService,
    private readonly store: MobiPreviewStatusStore,
    private readonly queue: MobiPreviewQueue,
  ) {}

  async execute(
    conversionId: string,
    jobId: string,
    userId: string,
  ): Promise<MobiPreviewStartResponse> {
    const { job } = await assertAuthorizedJob(this.conversions, this.jobs, conversionId, jobId, userId)
    const outputFile = job.outputFile as string

    // Cache hit?
    if (await this.service.isCacheValid(conversionId, jobId, outputFile)) {
      const index = (await this.service.readIndex(conversionId, jobId, outputFile)) as MobiPreviewIndex | null
      return {
        status: 'ready',
        totalPages: index?.pages.length ?? 0,
        cached: true,
      }
    }

    // Ja existe extracao em curso? Idempotente — nao reenfileira.
    const live = await this.store.get(jobId)
    if (live && (live.status === 'queued' || live.status === 'extracting')) {
      return { status: 'processing', cached: false }
    }

    await this.store.set(jobId, {
      status: 'queued',
      totalPages: 0,
      readyPages: 0,
      currentStep: 'Queued for extraction',
      updatedAt: new Date().toISOString(),
    })

    await this.queue.enqueue({
      conversionId,
      jobId,
      outputFile,
    })

    return { status: 'processing', cached: false }
  }
}

/**
 * GET /preview — status agregado.
 * Combina Redis Hash (live) + FS (index.json + countReadyPages + cacheUntil).
 */
export class GetMobiPreviewStatusUseCase {
  constructor(
    private readonly conversions: ConversionRepository,
    private readonly jobs: ConversionJobRepository,
    private readonly service: MobiPreviewService,
    private readonly store: MobiPreviewStatusStore,
  ) {}

  async execute(
    conversionId: string,
    jobId: string,
    userId: string,
  ): Promise<MobiPreviewStatusResponse> {
    const { job } = await assertAuthorizedJob(this.conversions, this.jobs, conversionId, jobId, userId)
    const outputFile = job.outputFile as string

    const live = await this.store.get(jobId)

    let totalPages = live?.totalPages ?? 0
    const readyPages = await this.service.countReadyPages(conversionId, jobId, outputFile)

    let cacheUntil: string | null = null
    const index = await this.service.readIndex(conversionId, jobId, outputFile)
    if (index) totalPages = index.pages.length
    cacheUntil = await this.service.cacheUntil(conversionId, jobId, outputFile)

    // Quando o Redis Hash expirou (TTL 6h) mas o cache FS ainda e valido
    // (TTL 24h), inferimos o status correto a partir do disco em vez de
    // retornar o fallback 'queued' que confundiria o frontend.
    let status = live?.status ?? 'queued'
    if (!live && await this.service.isCacheValid(conversionId, jobId, outputFile)) {
      status = 'ready'
    }

    return {
      status: ACCEPTED_MOBI_STAGES.has(status) ? status : 'queued',
      totalPages,
      readyPages,
      cacheUntil,
      error: live?.error,
    }
  }
}

/**
 * GET /preview/pages/:index — resolve path da pagina no /temp/.
 * O controller abre o stream e retorna a imagem ao cliente.
 */
export class GetMobiPreviewPageUseCase {
  constructor(
    private readonly conversions: ConversionRepository,
    private readonly jobs: ConversionJobRepository,
    private readonly service: MobiPreviewService,
  ) {}

  async execute(
    conversionId: string,
    jobId: string,
    userId: string,
    pageIndex: number,
  ): Promise<{ filePath: string; contentType: string }> {
    const { job } = await assertAuthorizedJob(this.conversions, this.jobs, conversionId, jobId, userId)
    return this.service.resolvePageFile(conversionId, jobId, job.outputFile as string, pageIndex)
  }
}