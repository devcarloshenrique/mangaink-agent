import { getSourceRepository } from '../../../shared/database/repositories'
import { ChapterImageService } from '../services/chapter-image.service'
import { getJobStatus } from '../services/chapter-download-status-store'
import { resolveProvider } from '../utils/resolve-provider'
import { env } from '../../../shared/config/env'
import { SourceNotFoundError } from '../errors/scraping.errors'
import { ChapterNotFoundError } from '../errors/chapter-download.errors'
import type { ChapterDownloadStatus } from '../types/chapter-download.types'

export interface GetChapterDownloadResult {
  status: ChapterDownloadStatus | 'not_downloaded'
  totalImages: number | null
  downloadedImages: number
  jobId: string | null
  /** Motivo da falha — preenchido quando status = 'failed'. */
  error?: string | null
}

/** Statuses do StatusStore que sobrepõem a derivação por cache. */
const OVERLAY_STATUSES = new Set(['queued', 'downloading', 'failed'])

export class GetChapterDownloadUseCase {
  async execute(sourceId: string, chapterId: string): Promise<GetChapterDownloadResult> {
    const source = await getSourceRepository().load(sourceId)
    if (!source) {
      throw new SourceNotFoundError(sourceId)
    }

    const chapter = source.chapters.find((c) => c.id === chapterId)
    if (!chapter) {
      throw new ChapterNotFoundError(sourceId, chapterId)
    }

    const provider = await resolveProvider(sourceId)
    const service = new ChapterImageService(provider!, sourceId, chapterId, env.STORAGE_PATH)

    // 1. Deriva o estado por cache/manifest (fonte da verdade em disco).
    let result = await this.deriveFromCache(service)

    // 2. Overlay do job no StatusStore: status ao vivo (queued/downloading) e
    //    motivo de falha — a derivação por cache não sabe desses estados.
    const job = await getJobStatus(sourceId, chapterId).catch(() => null)
    if (!job || !OVERLAY_STATUSES.has(job.status)) return result

    // Falha só sobrepõe se o cache NÃO já provou que está pronto (o registro
    // no store pode ser resíduo de uma tentativa anterior ao cache atual).
    if (job.status === 'failed') {
      if (result.status !== 'ready') {
        result = { ...result, status: 'failed', error: job.error ?? null, jobId: job.jobId }
      }
      return result
    }

    result = { ...result, status: job.status as ChapterDownloadStatus, jobId: job.jobId }
    return result
  }

  private async deriveFromCache(
    service: ChapterImageService,
  ): Promise<GetChapterDownloadResult> {
    const cachedCount = await service.countCachedImages()
    const manifest = await service.readManifest()

    // Todas as imagens em disco → pronto
    if (manifest && cachedCount >= manifest.totalImages) {
      return {
        status: 'ready',
        totalImages: manifest.totalImages,
        downloadedImages: cachedCount,
        jobId: null,
      }
    }

    // Sem imagens em disco, mas pelo menos 1 → também pronto (cache parcial)
    if (cachedCount > 0 && !manifest) {
      return {
        status: 'ready',
        totalImages: cachedCount,
        downloadedImages: cachedCount,
        jobId: null,
      }
    }

    // Manifest existe mas nem todas as imagens estão em disco → download em progresso
    if (manifest && manifest.totalImages > 0) {
      return {
        status: 'downloading',
        totalImages: manifest.totalImages,
        downloadedImages: cachedCount,
        jobId: null,
      }
    }

    // Imagens em disco sem manifest (capítulo baixado via conversão antiga)
    if (cachedCount > 0) {
      return {
        status: 'ready',
        totalImages: cachedCount,
        downloadedImages: cachedCount,
        jobId: null,
      }
    }

    return {
      status: 'not_downloaded',
      totalImages: null,
      downloadedImages: 0,
      jobId: null,
    }
  }
}
