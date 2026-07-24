import { readFile, readdir } from 'node:fs/promises'
import { join, extname } from 'node:path'
import { getSourceRepository } from '../../../shared/database/repositories'
import { ChapterImageService } from '../services/chapter-image.service'
import { resolveProvider } from '../utils/resolve-provider'
import { env } from '../../../shared/config/env'
import { SourceNotFoundError } from '../errors/scraping.errors'
import { ChapterNotFoundError, PageNotFoundError, InvalidPageIndexError, PageNotReadyError } from '../errors/chapter-download.errors'

export interface ServeChapterImageResult {
  buffer: Buffer
  contentType: string
  isCached: boolean
}

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.avif'])

function isImageFile(filename: string): boolean {
  const ext = extname(filename).toLowerCase()
  return IMAGE_EXTENSIONS.has(ext)
}

function detectContentType(buffer: Buffer): string {
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg'
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return 'image/png'
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) return 'image/webp'
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) return 'image/gif'
  if (buffer[0] === 0x42 && buffer[1] === 0x4d) return 'image/bmp'
  return 'image/octet-stream'
}

export class ServeChapterImageUseCase {
  async execute(sourceId: string, chapterId: string, index: number): Promise<ServeChapterImageResult> {
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

    const manifest = await service.readManifest()

    if (index < 1) {
      throw new InvalidPageIndexError(index, manifest?.totalImages ?? 0)
    }

    if (manifest && (index > manifest.totalImages)) {
      throw new InvalidPageIndexError(index, manifest.totalImages)
    }

    // 1. Cache hit — tenta encontrar arquivo com extensão conhecida
    const cacheDir = service.getCacheDir()
    const paddedIndex = String(index).padStart(4, '0')

    try {
      const entries = await readdir(cacheDir)
      const match = entries.find((f) => f.startsWith(paddedIndex) && isImageFile(f))
      if (match) {
        const filePath = join(cacheDir, match)
        const buffer = await readFile(filePath)
        return {
          buffer,
          contentType: detectContentType(buffer),
          isCached: true,
        }
      }
    } catch {
      // diretório não existe
    }

    // 2. Cache miss + manifest exists — proxy via provider.downloadImage()
    if (manifest && manifest.urls[index - 1]) {
      const url = manifest.urls[index - 1]
      try {
        const { buffer, contentType } = await provider!.downloadImage(url)
        return {
          buffer,
          contentType,
          isCached: false,
        }
      } catch {
        // Proxy falhou (URL expirada, timeout) — retornar 425 para o frontend fazer retry
        const readyCount = await service.countCachedImages()
        throw new PageNotReadyError(sourceId, chapterId, index, readyCount, manifest.totalImages)
      }
    }

    // 3. Cache miss + no manifest + chapter.url exists — fallback
    if (chapter.url) {
      const imageUrls = await provider!.getChapterImages(chapter.url)
      if (index > imageUrls.length) {
        throw new InvalidPageIndexError(index, imageUrls.length)
      }
      const url = imageUrls[index - 1]
      const { buffer, contentType } = await provider!.downloadImage(url)
      return {
        buffer,
        contentType,
        isCached: false,
      }
    }

    throw new PageNotFoundError(sourceId, chapterId, index)
  }
}
