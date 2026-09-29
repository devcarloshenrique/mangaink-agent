import { getSourceRepository } from '../../../shared/database/repositories'
import { ChapterImageService } from '../services/chapter-image.service'
import { resolveProvider } from '../utils/resolve-provider'
import { env } from '../../../shared/config/env'
import { SourceNotFoundError } from '../errors/scraping.errors'
import { ChapterNotFoundError } from '../errors/chapter-download.errors'

export interface ChapterPagesResult {
  sourceId: string
  chapterId: string
  totalPages: number
  pageUrls: string[]
}

export class GetChapterPagesUseCase {
  async execute(sourceId: string, chapterId: string): Promise<ChapterPagesResult> {
    const repository = getSourceRepository()
    const source = await repository.load(sourceId)
    if (!source) {
      throw new SourceNotFoundError(sourceId)
    }

    const chapter = source.chapters.find((c) => c.id === chapterId)
    if (!chapter) {
      throw new ChapterNotFoundError(sourceId, chapterId)
    }

    const provider = await resolveProvider(sourceId)
    if (!provider) {
      throw new SourceNotFoundError(sourceId)
    }

    const service = new ChapterImageService(provider, sourceId, chapterId, env.STORAGE_PATH)

    // 1. Se já existe manifest.json, utiliza o totalImages já mapeado
    const manifest = await service.readManifest()
    if (manifest && manifest.totalImages > 0) {
      const pageUrls = Array.from(
        { length: manifest.totalImages },
        (_, i) => `/api/sources/${encodeURIComponent(sourceId)}/chapters/${encodeURIComponent(chapterId)}/images/${i + 1}`,
      )
      return {
        sourceId,
        chapterId,
        totalPages: manifest.totalImages,
        pageUrls,
      }
    }

    // 2. Sem manifesto: busca as URLs no provider e salva o manifesto sob demanda
    if (chapter.url) {
      const imageUrls = await provider.getChapterImages(chapter.url)
      if (imageUrls.length > 0) {
        await service.writeManifest({
          totalImages: imageUrls.length,
          urls: imageUrls,
        })

        // Atualiza pages no metadata se ainda não estava preenchido
        try {
          if (!chapter.pages || chapter.pages !== imageUrls.length) {
            chapter.pages = imageUrls.length
            await repository.save(sourceId, source)
          }
        } catch {
          // Ignora falha não-crítica de persistência de metadata
        }

        const pageUrls = Array.from(
          { length: imageUrls.length },
          (_, i) => `/api/sources/${encodeURIComponent(sourceId)}/chapters/${encodeURIComponent(chapterId)}/images/${i + 1}`,
        )
        return {
          sourceId,
          chapterId,
          totalPages: imageUrls.length,
          pageUrls,
        }
      }
    }

    return {
      sourceId,
      chapterId,
      totalPages: 0,
      pageUrls: [],
    }
  }
}
