import { join, extname } from 'node:path'
import { readdir } from 'node:fs/promises'
import { pathExists } from '../../../shared/utils/filesystem'
import { env } from '../../../shared/config/env'
import type { SourceInspectResponse, Chapter } from '../types/source.types'
import type { SourceCacheRepository } from '../repositories/source-cache.repository'
import type { UserChapterProgressRepository } from '../../reading/repositories/user-chapter-progress.repository'
import { SourceNotFoundError } from '../errors/scraping.errors'

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.avif'])

function isImageFile(filename: string): boolean {
  const ext = extname(filename).toLowerCase()
  return IMAGE_EXTENSIONS.has(ext)
}

async function isChapterDownloaded(sourceId: string, chapterId: string): Promise<boolean> {
  const cacheDir = join(env.STORAGE_PATH, 'sources', sourceId, 'chapters', chapterId)

  if (!(await pathExists(cacheDir))) return false

  try {
    const entries = await readdir(cacheDir)
    return entries.some((f) => isImageFile(f))
  } catch {
    return false
  }
}

/**
 * Caso de uso: buscar os dados completos de uma source já inspecionada.
 * Remove o campo `cache` antes de retornar (nunca exposto pela API).
 * Adiciona campo `isDownloaded` e `isRead` a cada capítulo.
 */
export class GetSourceUseCase {
  constructor(
    private readonly sourceRepository: SourceCacheRepository,
    private readonly readingRepository?: UserChapterProgressRepository,
  ) {}

  async execute(sourceId: string, userId?: string): Promise<SourceInspectResponse> {
    const metadata = await this.sourceRepository.load(sourceId)

    if (!metadata) {
      throw new SourceNotFoundError(sourceId)
    }

    // Computa isRead se userId disponível
    const readSet = userId && this.readingRepository
      ? new Set(
          (await this.readingRepository.findByUserAndSource(userId, sourceId)).map(
            (r) => r.chapterId,
          ),
        )
      : new Set<string>()

    // Computa isDownloaded e isRead para cada capítulo
    const chapters: Chapter[] = await Promise.all(
      metadata.chapters.map(async (ch) => ({
        ...ch,
        isDownloaded: await isChapterDownloaded(sourceId, ch.id),
        isRead: readSet.has(ch.id),
      })),
    )

    // Remove o campo interno `cache` da resposta
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { cache: _cache, ...response } = metadata

    return { ...response, chapters } as SourceInspectResponse
  }
}
