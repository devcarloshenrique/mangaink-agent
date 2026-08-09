import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { env } from '../../../shared/config/env'
import { mkdirp } from '../../../shared/utils/filesystem'
import { getSourceRepository } from '../../../shared/database/repositories'
import { resolveProvider } from '../utils/resolve-provider'
import { ChapterImageService } from '../services/chapter-image.service'
import { RedisPubSubAdapter, RedisJournalAdapter } from '../../../shared/infra/redis'
import { ChapterDownloadEventsService } from '../services/chapter-download-events.service'
import { setJobStatus, setChapterDownloadStatusStore } from '../services/chapter-download-status-store'
import type { RuntimeAdapters } from '../../../shared/infra/factory'
import {
  startQueueWorker,
  type QueueWorkerHandle,
  type QueueWorkerJob,
} from '../../../shared/infra/queue-worker'
import type { ChapterDownloadData } from '../types/chapter-download.types'

/**
 * Events padrão (modo web) criados lazy — preserva a compatibilidade do
 * `processChapterDownload` sem conexão no load do módulo.
 */
let defaultEvents: ChapterDownloadEventsService | null = null

function getDefaultEvents(): ChapterDownloadEventsService {
  if (!defaultEvents) {
    defaultEvents = new ChapterDownloadEventsService(new RedisPubSubAdapter(), new RedisJournalAdapter())
  }
  return defaultEvents
}

export async function processChapterDownload(
  job: { data: ChapterDownloadData; id?: string },
  events?: ChapterDownloadEventsService,
): Promise<void> {
  const eventsService = events ?? getDefaultEvents()
  const { sourceId, chapterId } = job.data
  const jobId = job.id ?? ''

  if (jobId) {
    await setJobStatus(sourceId, chapterId, jobId, 'downloading')
  }

  try {
    const source = await getSourceRepository().load(sourceId)
    if (!source) {
      throw new Error(`Source ${sourceId} não encontrada`)
    }

    const chapter = source.chapters.find((c) => c.id === chapterId)
    if (!chapter?.url) {
      throw new Error(`Capítulo ${chapterId} não encontrado ou sem URL`)
    }

    const provider = await resolveProvider(sourceId)
    if (!provider) {
      throw new Error(`Provider não encontrado para source ${sourceId}`)
    }

    const service = new ChapterImageService(provider, sourceId, chapterId, env.STORAGE_PATH)

    const imageUrls = await provider.getChapterImages(chapter.url)

    if (!imageUrls || imageUrls.length === 0) {
      throw new Error(`Nenhuma imagem encontrada para o capítulo ${chapterId}`)
    }

    const manifest = { totalImages: imageUrls.length, urls: imageUrls }
    await service.writeManifest(manifest)

    await eventsService.emit(sourceId, chapterId, eventsService.createEvent('progress', { downloaded: 0, total: imageUrls.length }))

    let downloaded = 0
    let errors = 0
    const cacheDir = service.getCacheDir()

    for (let i = 0; i < imageUrls.length; i++) {
      try {
        const { buffer, contentType } = await provider.downloadImage(imageUrls[i])

        const ext = contentTypeToExt(contentType) ?? '.jpg'
        const filename = `${String(i + 1).padStart(4, '0')}${ext}`

        await mkdirp(cacheDir)
        await writeFile(join(cacheDir, filename), buffer)
        downloaded++

        await eventsService.emit(sourceId, chapterId, eventsService.createEvent('progress', { downloaded, total: imageUrls.length }))
      } catch {
        errors++
      }
    }

    if (downloaded === 0) {
      throw new Error(`Falha ao baixar todas as ${imageUrls.length} imagens`)
    }

    if (jobId) {
      await setJobStatus(sourceId, chapterId, jobId, 'completed')
    }

    await eventsService.emit(sourceId, chapterId, eventsService.createEvent('completed', { totalImages: imageUrls.length, downloaded, errors }))
  } catch (err) {
    if (jobId) {
      await setJobStatus(sourceId, chapterId, jobId, 'failed')
    }
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    await eventsService.emit(sourceId, chapterId, eventsService.createEvent('failed', { error: message }))
    throw err
  }
}

function contentTypeToExt(contentType: string): string | null {
  const map: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'image/bmp': '.bmp',
    'image/avif': '.avif',
  }
  return map[contentType] ?? null
}

/**
 * Worker de download de capítulos (fila `chapter-download`, concorrência 1).
 *
 * Factory: injeta o status store e o events service a partir do runtime —
 * NENHUMA conexão é aberta no load do módulo.
 */
export function startChapterDownloadWorker(deps: { runtime: RuntimeAdapters }): QueueWorkerHandle {
  const { runtime } = deps

  setChapterDownloadStatusStore(runtime.status)
  const events = new ChapterDownloadEventsService(runtime.pubsub, runtime.journal)

  return startQueueWorker({
    runtime,
    queueName: 'chapter-download',
    concurrency: 1,
    processor: async (job: QueueWorkerJob) => {
      await processChapterDownload({ data: job.data as ChapterDownloadData, id: job.id }, events)
    },
  })
}
