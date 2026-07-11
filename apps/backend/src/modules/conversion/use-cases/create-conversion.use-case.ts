import { join } from 'node:path'
import { readJson, pathExists } from '../../../shared/utils/filesystem'
import { env } from '../../../shared/config/env'
import { createConversionId, createJobId } from '../../../shared/utils/id-generator'
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
import type { ConversionEventsService } from '../services/conversion-events.service'
import {
  ValidationError,
  SourceNotFoundError,
  DuplicateChapterError,
  ChapterNotFoundError,
} from '../errors/conversion.errors'

interface SourceMetadata {
  chapters: Array<{ id: string }>
}

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
 *  - persiste a Conversion e cada Job em disco;
 *  - enfileira cada Job no BullMQ;
 *  - emite evento `conversion.created`.
 */
export class CreateConversionUseCase {
  constructor(
    private readonly conversions: ConversionRepository,
    private readonly jobs: ConversionJobRepository,
    private readonly queue: ConversionQueueService,
    private readonly events: ConversionEventsService,
  ) {}

  async execute(request: ConversionConfig): Promise<{
    conversionId: string
    status: 'queued'
    totalJobs: number
    createdAt: string
  }> {
    // ── Valida dispositivo/formato ──────────────────────────────────
    if (!devices.some((d) => d.id === request.output.deviceId)) {
      throw new ValidationError(`Dispositivo inválido: ${request.output.deviceId}`)
    }
    if (!formats.some((f) => f.id === request.output.format)) {
      throw new ValidationError(`Formato inválido: ${request.output.format}`)
    }

    // ── Valida existência da source e capítulos ─────────────────────
    const sourceMetaPath = join(env.STORAGE_PATH, 'sources', request.sourceId, 'metadata.json')
    if (!(await pathExists(sourceMetaPath))) {
      throw new SourceNotFoundError(request.sourceId)
    }
    const sourceMeta = await readJson<SourceMetadata>(sourceMetaPath)
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
        output: request.output,
        metadata: {
          title: book.title,
          author: request.metadata.author,
        },
        options: jobOptions,
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
        output: request.output,
        metadata: { title: book.title, author: request.metadata.author },
        options: jobOptions,
        storagePath,
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
    // O jobs repository é scoped por conversionId para aninhar corretamente.
    const scopedJobs = this.jobs.withConversion(conversionId)
    for (const jobState of jobStates) {
      await scopedJobs.create(jobState)
    }

    // ── Enfileira cada Job no BullMQ ────────────────────────────────
    for (const data of jobDataList) {
      await this.queue.enqueue(data)
    }

    // ── Evento de criação ───────────────────────────────────────────
    await this.events.emit(conversionId, this.events.createEvent('conversion.created', {
      conversionId,
      totalJobs: jobStates.length,
      jobIds: jobStates.map((j) => j.jobId),
    }))

    return {
      conversionId,
      status: 'queued',
      totalJobs: jobStates.length,
      createdAt: now,
    }
  }
}