import { join, extname } from 'node:path'
import { writeFile } from 'node:fs/promises'
import { env } from '../../../shared/config/env'
import { logger } from '../../../shared/logging/logger'
import { mkdirp, pathExists } from '../../../shared/utils/filesystem'
import { assertValidImage } from '../../../shared/utils/image-validation'
import { ConversionEventsService } from '../services/conversion-events.service'
import { ImageDownloaderService } from '../services/image-downloader.service'
import { PlaceholderService } from '../services/placeholder.service'
import {
  getSourceRepository,
  getConversionRepository,
  getConversionJobRepository,
  getNotificationRepository,
} from '../../../shared/database/repositories'
import { resolveProvider } from '../../scraping/utils/resolve-provider'
import { JobLiveStatusStore } from '../../../shared/redis/job-status-store'
import type { RuntimeAdapters } from '../../../shared/infra/factory'
import {
  startQueueWorker,
  type QueueWorkerHandle,
  type QueueWorkerJob,
} from '../../../shared/infra/queue-worker'
import type { ConversionJobData, ErrorHandlingStrategy, JobStatus } from '../types/conversion.types'
import type { IProviderStrategy } from '../../scraping/interfaces/provider-strategy.interface'
import {
  createNotificationService,
  type NotificationService,
} from '../../notification/services/notification.service'
import {
  createOwnerNotifier,
  type OwnerNotifier,
} from '../../notification/services/owner-notifier'
import type { FailedChapter } from '../../notification/types/notification.types'

// ── Dependencies (injeção para testabilidade) ──────────────────────────

export interface DownloadOnlyWorkerDeps {
  jobRepository: ReturnType<typeof getConversionJobRepository>
  conversionRepository: ReturnType<typeof getConversionRepository>
  sourceRepository: ReturnType<typeof getSourceRepository>
  events: ConversionEventsService
  jobLiveStatusStore: JobLiveStatusStore
  resolveProvider: (sourceId: string) => Promise<IProviderStrategy | null>
  downloader: ImageDownloaderService
  placeholderService: PlaceholderService
  /** Opcional para não quebrar testes existentes — quando ausente, sem notificações. */
  notifications?: NotificationService
}

export async function processDownloadOnlyJob(
  data: ConversionJobData,
  deps: DownloadOnlyWorkerDeps,
): Promise<{ jobId: string; status: string; successfulChapters?: string[]; totalImages?: number }> {
  const { conversionId, jobId, sourceId, chapters, errorHandlingStrategy } = data
  const { jobRepository, conversionRepository, sourceRepository, events, jobLiveStatusStore } = deps

  const sync = () => conversionRepository.syncStatus(conversionId).catch(() => {})

  /**
   * Emite notificação de fim/falha ao dono da conversão (best-effort —
   * nunca derruba o job). O userId vem do config persistido e conversões
   * canceladas são suprimidas (ver owner-notifier).
   */
  const notifyOwner: OwnerNotifier = createOwnerNotifier(
    conversionRepository,
    deps.notifications,
  )

  /** Detalhe dos capítulos não baixados — alimenta o bloco expansível da UI. */
  const failedChapterDetails: FailedChapter[] = []
  const trackFailedChapter = (chapterId: string, reason: string) => {
    failedChapterDetails.push({ chapterId, reason })
  }

  const setLiveStatus = (status: JobStatus, currentStep: string) => {
    return jobLiveStatusStore
      .set(jobId, { status, currentStep, updatedAt: new Date().toISOString() })
      .catch(() => {})
  }

  await setLiveStatus('preparing', 'Preparing download...')
  await sync()
  await jobRepository.appendLog(
    jobId,
    `Download iniciado — ${chapters.length} capítulos selecionados (download-only)`,
  )
  await events.emit(jobId, events.createEvent('job.started', { jobId, downloadOnly: true }))

  await setLiveStatus('downloading', 'Downloading images...')
  await sync()
  await events.emit(
    jobId,
    events.createEvent('download.started', {
      jobId,
      totalChapters: chapters.length,
      downloadOnly: true,
    }),
  )

  let totalDownloaded = 0
  let cumulativeTotalImages = 0
  const skippedChapters: string[] = []
  const successfulChapters: string[] = []

  const strategy: ErrorHandlingStrategy = errorHandlingStrategy ?? 'ignore'
  const placeholderService = deps.placeholderService

  const provider = await deps.resolveProvider(sourceId)
  if (!provider) {
    throw new Error(`Não foi possível resolver o provider para sourceId: ${sourceId}`)
  }

  for (const chapterId of chapters) {
    const cancelled = (await jobLiveStatusStore.get(jobId))?.status === 'cancelled'
    if (cancelled) {
      await jobRepository.appendLog(jobId, 'Job cancelado durante download')
      return { jobId, status: 'cancelled' }
    }

    const imageUrls = await getChapterImageUrls(provider, sourceId, chapterId, sourceRepository)

    if (imageUrls.length === 0) {
      await jobRepository.appendLog(
        jobId,
        `Capítulo ${chapterId} ignorado — nenhuma imagem disponível no site de origem`,
      )
      skippedChapters.push(chapterId)
      trackFailedChapter(chapterId, 'Sem imagens disponíveis no site de origem')
      await sourceRepository.updateChapterUnavailableReason(sourceId, chapterId, 'Indisponível no site de origem').catch(() => {})
      await events.emit(
        jobId,
        events.createEvent('download.chapter.skipped', {
          chapterId,
          totalImages: 0,
          errors: 1,
          reason: 'no_images_available',
        }),
      )
      continue
    }

    const result = await deps.downloader.downloadChapter(jobId, sourceId, chapterId, imageUrls, provider)

    totalDownloaded += result.downloadedImages
    cumulativeTotalImages += result.totalImages

    if (result.corruptPages.length > 0) {
      if (strategy === 'abort') {
        await jobRepository.appendLog(
          jobId,
          `ABORTAR: ${result.corruptPages.length} páginas corrompidas no capítulo ${chapterId}. Estratégia: abort`,
        )
        throw new Error(`Páginas corrompidas encontradas no capítulo ${chapterId}. Estratégia de erro: abort.`)
      }

      if (strategy === 'skip_chapter') {
        await jobRepository.appendLog(
          jobId,
          `Capítulo ${chapterId} ignorado — ${result.corruptPages.length} páginas corrompidas. Estratégia: skip_chapter`,
        )
        skippedChapters.push(chapterId)
        trackFailedChapter(chapterId, `${result.corruptPages.length} página(s) corrompida(s)`)
        await sourceRepository.updateChapterUnavailableReason(sourceId, chapterId, 'Páginas corrompidas').catch(() => {})
        await jobLiveStatusStore
          .set(jobId, { downloadedImages: totalDownloaded, totalImages: cumulativeTotalImages, updatedAt: new Date().toISOString() })
          .catch(() => {})
        continue
      }

      if (strategy === 'ignore') {
        const cacheDir = join(env.STORAGE_PATH, 'sources', sourceId, 'chapters', chapterId)

        if (result.fromCache) {
          await jobRepository.appendLog(
            jobId,
            `Capítulo ${chapterId}: ${result.corruptPages.length} placeholder(s) em cache. Nenhuma ação necessária.`,
          )
          successfulChapters.push(chapterId)
          await sourceRepository.updateChapterUnavailableReason(sourceId, chapterId, null).catch(() => {})
        } else {
          let placeholderCount = 0
          for (const cp of result.corruptPages) {
            const filename = `${String(cp.pageIndex).padStart(4, '0')}.png`
            const cachePath = join(cacheDir, filename)
            try {
              const pageLabel = `Cap. ${chapterId.replace(/^chap_0*/, '')}, Pág. ${cp.pageIndex}`
              const placeholder = await placeholderService.generateDefault(pageLabel)
              await writeFile(cachePath, placeholder)
              placeholderCount++
            } catch (err) {
              await jobRepository.appendLog(
                jobId,
                `Erro ao gerar placeholder para ${chapterId} página ${cp.pageIndex}: ${err instanceof Error ? err.message : 'unknown'}`,
              )
            }
          }

          const placeholderIndices = result.corruptPages.map((cp) => cp.pageIndex)
          await sourceRepository.updatePlaceholderIndices(sourceId, chapterId, placeholderIndices)

          await jobRepository.appendLog(
            jobId,
            `${placeholderCount}/${result.corruptPages.length} placeholders gerados para capítulo ${chapterId}`,
          )

          totalDownloaded += placeholderCount
          successfulChapters.push(chapterId)
          await sourceRepository.updateChapterUnavailableReason(sourceId, chapterId, null).catch(() => {})
        }
      }
    } else if (result.skipped) {
      skippedChapters.push(chapterId)
      trackFailedChapter(chapterId, 'Indisponível no site de origem')
      await sourceRepository.updateChapterUnavailableReason(sourceId, chapterId, 'Indisponível no site de origem').catch(() => {})
    } else {
      successfulChapters.push(chapterId)
      await sourceRepository.updateChapterUnavailableReason(sourceId, chapterId, null).catch(() => {})
    }
  }

  if (successfulChapters.length === 0) {
    throw new Error(`Nenhum capítulo pôde ser baixado (${skippedChapters.length}\u00A0indisponível(is) no site de origem).`)
  }

  if (skippedChapters.length > 0) {
    await jobRepository.appendLog(
      jobId,
      `AVISO: ${skippedChapters.length} capítulo(s) ignorado(s) por indisponibilidade: ${skippedChapters.join(', ')}. ` +
        `${successfulChapters.length} capítulo(s) baixado(s) com sucesso.`,
    )
  }

  // ── Download da capa original ──────────────────────────────────
  try {
    const sourceMeta = await sourceRepository.load(sourceId)
    if (sourceMeta?.covers && sourceMeta.covers.length > 0) {
      const cover = sourceMeta.covers.find((c) => c.type === 'original') ?? sourceMeta.covers[0]
      if (cover?.imageUrl) {
        const coversDir = join(env.STORAGE_PATH, 'sources', sourceId, 'covers')
        const urlExt = extname(new URL(cover.imageUrl).pathname).toLowerCase() || '.jpg'
        const coverPath = join(coversDir, `${cover.id}${urlExt}`)
        const alreadyCached = await pathExists(coverPath)
        if (!alreadyCached) {
          await mkdirp(coversDir)
          const { buffer } = await provider.downloadImage(cover.imageUrl)
          assertValidImage(buffer)
          await writeFile(coverPath, buffer)
          await jobRepository.appendLog(jobId, `Capa baixada: ${coverPath}`)
        }
      }
    }
  } catch (err) {
    await jobRepository.appendLog(
      jobId,
      `Aviso: falha ao baixar capa — ${err instanceof Error ? err.message : 'unknown'}`,
    )
  }

  // ── Job finished ────────────────────────────────────────────────
  await jobRepository.update(jobId, {
    status: 'completed',
    progress: 100,
    currentStep: 'Done',
    downloadedImages: totalDownloaded,
    totalImages: cumulativeTotalImages,
    completedAt: new Date().toISOString(),
  })
  await jobLiveStatusStore.clear(jobId).catch(() => {})
  await sync()

  await jobRepository.appendLog(
    jobId,
    `Download concluído — ${successfulChapters.length} capítulos, ${totalDownloaded} imagens baixadas`,
  )

  await events.emit(
    jobId,
    events.createEvent('job.finished', {
      jobId,
      downloadOnly: true,
      successfulChapters: successfulChapters.length,
      totalImages: totalDownloaded,
    }),
  )

  await events.emit(
    conversionId,
    events.createEvent('conversion.completed', {
      conversionId,
      status: 'completed',
      successfulChapters: successfulChapters.length,
      totalImages: totalDownloaded,
    }),
  )

  // Notificação de conclusão com contagem X/Y e falhas (se houver).
  const failedCount = failedChapterDetails.length
  const totalCount = chapters.length
  const successCount = successfulChapters.length
  await notifyOwner(conversionId, jobId, () => ({
    type: 'download_completed',
    title: failedCount > 0
      ? `Download concluído com ${failedCount} falha(s)`
      : 'Download concluído',
    message: failedCount > 0
      ? `${successCount}/${totalCount} capítulo(s) baixado(s) • ${failedCount} falha(s)`
      : `${successCount}/${totalCount} capítulo(s) baixado(s)`,
    metadata: {
      successfulChapters: successCount,
      totalImages: totalDownloaded,
      ...(failedCount > 0 ? { failedChapters: failedChapterDetails } : {}),
    },
  }))

  return { jobId, status: 'completed', successfulChapters, totalImages: totalDownloaded }
}

/**
 * Worker de download-only (fila `download-only`, concorrência 3).
 *
 * Factory: constrói as dependências a partir do runtime injetado — NENHUMA
 * conexão é aberta no load do módulo. `onFailed` preserva a semântica do
 * antigo `downloadOnlyWorker.on('failed')`.
 */
export function startDownloadOnlyWorker(deps: { runtime: RuntimeAdapters }): QueueWorkerHandle {
  const { runtime } = deps

  const events = new ConversionEventsService(runtime.pubsub, runtime.journal)
  const jobRepository = getConversionJobRepository()
  const sourceRepository = getSourceRepository()

  const workerDeps: DownloadOnlyWorkerDeps = {
    jobRepository,
    conversionRepository: getConversionRepository(runtime.status),
    sourceRepository,
    events,
    jobLiveStatusStore: new JobLiveStatusStore(runtime.status),
    resolveProvider,
    downloader: new ImageDownloaderService(events, jobRepository, sourceRepository),
    placeholderService: new PlaceholderService(),
    notifications: createNotificationService(getNotificationRepository(), runtime),
  }

  return startQueueWorker({
    runtime,
    queueName: 'download-only',
    concurrency: 3,
    processor: async (job: QueueWorkerJob) => {
      await processDownloadOnlyJob(job.data as ConversionJobData, workerDeps)
    },
    onFailed: async (job, error) => {
      const jobId = job.id
      const conversionId = (job.data as ConversionJobData | undefined)?.conversionId
      console.error(`[DownloadOnlyWorker] Job ${jobId ?? 'unknown'} failed:`, error.message)
      if (jobId && conversionId) {
        const failedRepo = getConversionJobRepository()
        const convRepo = getConversionRepository(runtime.status)
        await failedRepo.update(jobId, {
          status: 'failed',
          error: error.message.slice(0, 500),
          currentStep: 'Failed',
        })
        await workerDeps.jobLiveStatusStore.clear(jobId).catch(() => {})
        await failedRepo.appendLog(jobId, `ERRO: ${error.message.slice(0, 500)}`)
        await convRepo.syncStatus(conversionId)
        await events
          .emit(jobId, events.createEvent('job.failed', { jobId, conversionId, error: error.message.slice(0, 500) }))
          .catch(() => {})

        // Notificação de falha ao dono (best-effort; suprimida se cancelada).
        await createOwnerNotifier(convRepo, workerDeps.notifications)(
          conversionId,
          jobId,
          () => ({
            type: 'download_failed' as const,
            title: 'Download falhou',
            message: error.message.slice(0, 300),
          }),
        )
      }
    },
  })
}

async function getChapterImageUrls(
  provider: IProviderStrategy | null,
  sourceId: string,
  chapterId: string,
  sourceRepo: ReturnType<typeof getSourceRepository>,
): Promise<string[]> {
  const source = await sourceRepo.load(sourceId)
  if (!source || !provider) return []
  const chapter = source.chapters.find((c) => c.id === chapterId)
  if (!chapter?.url) return []
  const images = await provider.getChapterImages(chapter.url)
  if (images.length === 0) {
    logger.warn(
      { chapterId, url: chapter.url },
      '[DownloadOnlyWorker] Nenhuma imagem encontrada para o capitulo',
    )
  }
  return images
}
