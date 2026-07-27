import { join } from 'node:path'
import { env } from '../../../shared/config/env'
import { getSourceRepository } from '../../../shared/database/repositories'
import { createConversionId, createJobId } from '../../../shared/utils/id-generator'
import { CacheService } from '../../scraping/services/cache.service'
import { devices } from '../config/devices'
import { formats } from '../config/formats'
import type {
  Book,
  ConversionConfig,
  ConversionJobConfig,
  ConversionJobData,
  ConversionJobState,
  ConversionState,
  ConversionStatusFile,
  ConversionJobSummary,
  CoverRef,
} from '../types/conversion.types'
import type { ConversionRepository } from '../repositories/conversion.repository'
import type { ConversionJobRepository } from '../repositories/conversion-job.repository'
import type { ConversionQueueService } from '../services/conversion-queue.service'
import type { DownloadOnlyQueueService } from '../services/download-only-queue.service'
import type { ConversionEventsService } from '../services/conversion-events.service'
import {
  ValidationError,
  SourceNotFoundError,
  DuplicateChapterError,
  ChapterNotFoundError,
} from '../errors/conversion.errors'

/**
 * Conversion Planner.
 *
 * Responsabilidades:
 *  - valida a requisição (device, format, sourceId);
 *  - valida capítulos inexistentes e duplicados entre Books;
 *  - aplica herança da capa global (Books sem capa própria recebem a capa global);
 *  - gera 1 Job para cada Book;
 *  - define as flags internas do KCC (batchSplit, fileFusion) — responsabilidade
 *    exclusiva do Planner, nunca exposta pela API pública;
 *  - persiste a Conversion e cada Job via repositório;
 *  - enfileira cada Job no BullMQ;
 *  - emite evento `conversion.created`.
 *
 * Download-only:
 *  - pula validação de dispositivo/formato;
 *  - não define flags internas do KCC;
 *  - enfileira na fila `download-only` em vez de `conversion-job`.
 */
export class CreateConversionUseCase {
  constructor(
    private readonly conversions: ConversionRepository,
    private readonly jobs: ConversionJobRepository,
    private readonly queue: ConversionQueueService,
    private readonly events: ConversionEventsService,
    private readonly downloadOnlyQueue?: DownloadOnlyQueueService,
  ) {}

  async execute(request: ConversionConfig): Promise<{
    conversionId: string
    status: 'queued'
    totalJobs: number
    createdAt: string
  }> {
    // ── Valida dispositivo/formato ──────────────────────────────────
    const isDownloadOnly = request.downloadOnly === true
    const effectiveOutput = isDownloadOnly
      ? { deviceId: 'kindle_pw', format: 'epub' } // Dummy para download-only — não usado pelo worker
      : request.output

    if (!isDownloadOnly) {
      if (!devices.some((d) => d.id === effectiveOutput.deviceId)) {
        throw new ValidationError(`Dispositivo inválido: ${effectiveOutput.deviceId}`)
      }
      if (!formats.some((f) => f.id === effectiveOutput.format)) {
        throw new ValidationError(`Formato inválido: ${effectiveOutput.format}`)
      }
    }

    // ── Valida existência da source e capítulos ─────────────────────
    const sourceRepo = getSourceRepository()
    const sourceMeta = await sourceRepo.load(request.sourceId)
    if (!sourceMeta?.chapters) {
      throw new SourceNotFoundError(request.sourceId)
    }

    const availableChapterIds = new Set(sourceMeta.chapters.map((c) => c.id))
    const seen = new Set<string>()

    for (const book of request.books) {
      for (const chapterId of book.chapters) {
        if (!availableChapterIds.has(chapterId)) {
          throw new ChapterNotFoundError(chapterId, request.sourceId)
        }
        if (seen.has(chapterId)) {
          throw new DuplicateChapterError(chapterId)
        }
        seen.add(chapterId)
      }
    }

    // ── Herança de capa global + flags KCC internas ────────────────
    const conversionId = createConversionId()
    const now = new Date().toISOString()
    const jobsDir = join(env.CONVERSIONS_STORAGE_PATH, conversionId, 'jobs')

    const jobStates: ConversionJobState[] = []
    const jobDataList: ConversionJobData[] = []
    const jobSummaries: ConversionJobSummary[] = []

    request.books.forEach((book: Book, index: number) => {
      const effectiveCover: CoverRef = book.cover ?? request.cover
      const jobOptions: Record<string, string | number | boolean | undefined> = {
        ...request.options,
        // Flags internas do KCC — nunca enviadas pelo frontend.
        // O Planner sempre produce exatamente 1 EPUB por Book.
        batchSplit: 'none',
        // fileFusion SEMPRE false: nosso pipeline passa um único diretório
        // (temp/input/) ao KCC, que já processa todos os subdiretórios internos
        // como um único EPUB. A flag --filefusion só faz sentido com múltiplos
        // arquivos de entrada (ZIP/CBZ), não com subdiretórios.
        fileFusion: false,
      }

      const jobId = createJobId()
      const storagePath = join(jobsDir, jobId)

      const jobConfig: ConversionJobConfig = {
        conversionId,
        jobId,
        bookIndex: index,
        sourceId: request.sourceId,
        chapters: book.chapters,
        cover: effectiveCover,
        output: effectiveOutput,
        metadata: {
          title: book.title,
          author: request.metadata.author,
        },
        options: jobOptions,
        errorHandlingStrategy: request.errorHandlingStrategy,
      }

      const jobState: ConversionJobState = {
        jobId,
        status: 'queued',
        progress: 0,
        currentStep: 'Queued',
        downloadedImages: 0,
        totalImages: 0,
        createdAt: now,
        updatedAt: now,
        config: jobConfig,
      }

      jobStates.push(jobState)
      jobDataList.push({
        conversionId,
        jobId,
        bookIndex: index,
        sourceId: request.sourceId,
        chapters: book.chapters,
        cover: effectiveCover,
        output: effectiveOutput,
        metadata: { title: book.title, author: request.metadata.author },
        options: jobOptions,
        storagePath,
        errorHandlingStrategy: request.errorHandlingStrategy,
        downloadOnly: isDownloadOnly,
      })

      jobSummaries.push({
        jobId,
        index,
        title: book.title,
        status: 'queued',
        progress: 0,
      })
    })

    // ── Persiste a Conversion (config + status) ─────────────────────
    const status: ConversionStatusFile = {
      conversionId,
      status: 'queued',
      progress: 0,
      totalJobs: jobStates.length,
      completedJobs: 0,
      failedJobs: 0,
      runningJobs: 0,
      pendingJobs: jobStates.length,
      createdAt: now,
      updatedAt: now,
      jobs: jobSummaries,
    }

    const conversionState: ConversionState = { ...status, config: request }
    await this.conversions.create(conversionState)

    // ── Persiste cada Job (config + status) ─────────────────────────
    for (const jobState of jobStates) {
      await this.jobs.create(jobState)
    }

    // ── Enfileira cada Job no BullMQ ────────────────────────────────
    const targetQueue =
      isDownloadOnly && this.downloadOnlyQueue ? this.downloadOnlyQueue : this.queue

    for (const data of jobDataList) {
      await targetQueue.enqueue(data)
    }

    // ── Estende TTL da source para 30 dias ──────────────────────────
    const cacheService = new CacheService(sourceRepo)
    await cacheService.extendRetention(request.sourceId, 30).catch(() => {})

    // ── Evento de criação ───────────────────────────────────────────
    await this.events.emit(
      conversionId,
      this.events.createEvent('conversion.created', {
        conversionId,
        totalJobs: jobStates.length,
        jobIds: jobStates.map((j) => j.jobId),
        downloadOnly: isDownloadOnly || undefined,
      }),
    )

    return {
      conversionId,
      status: 'queued',
      totalJobs: jobStates.length,
      createdAt: now,
    }
  }
}
