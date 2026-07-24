import { getSourceRepository } from '../../../shared/database/repositories'
import { ChapterImageService } from '../services/chapter-image.service'
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
}

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