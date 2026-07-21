import { join, extname } from 'node:path'
import { readdir, writeFile } from 'node:fs/promises'
import { mkdirp, pathExists } from '../../../shared/utils/filesystem'
import { env } from '../../../shared/config/env'
import type { SourceCacheRepository } from '../../scraping/repositories/source-cache.repository'
import type { IProviderStrategy } from '../../scraping/interfaces/provider-strategy.interface'
import { ConversionNotFoundError } from '../errors/conversion.errors'

const MIME_MAP: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
}

export class ServeCoverUseCase {
  constructor(private readonly sources: SourceCacheRepository) {}

  async execute(sourceId: string, coverId: string): Promise<{ filePath: string; contentType: string }> {
    const source = await this.sources.load(sourceId)

    if (!source) {
      const diskHit = await this.findCachedFile(sourceId, coverId)
      if (diskHit) return diskHit
      throw new ConversionNotFoundError(`Source "${sourceId}" não encontrada`)
    }

    const isOriginalAlias = coverId === 'original'
    const cover = isOriginalAlias
      ? source.covers.find((c) => c.type === 'original') ?? source.covers[0]
      : source.covers.find((c) => c.id === coverId)
    if (!cover) {
      throw new ConversionNotFoundError(`Capa "${coverId}" não encontrada`)
    }

    const urlExt = extname(new URL(cover.imageUrl).pathname).toLowerCase() || '.jpg'
    const cachedPath = join(env.STORAGE_PATH, 'sources', sourceId, 'covers', `${coverId}${urlExt}`)

    if (await pathExists(cachedPath)) {
      return { filePath: cachedPath, contentType: MIME_MAP[urlExt] ?? 'image/jpeg' }
    }

    const provider = await this.resolveProvider(source)
    if (!provider) {
      throw new ConversionNotFoundError(`Provider não disponível para source "${sourceId}"`)
    }

    const { buffer } = await provider.downloadImage(cover.imageUrl)
    await mkdirp(join(env.STORAGE_PATH, 'sources', sourceId, 'covers'))
    await writeFile(cachedPath, buffer)

    return { filePath: cachedPath, contentType: MIME_MAP[urlExt] ?? 'image/jpeg' }
  }

  private async findCachedFile(
    sourceId: string,
    coverId: string,
  ): Promise<{ filePath: string; contentType: string } | null> {
    const coversDir = join(env.STORAGE_PATH, 'sources', sourceId, 'covers')
    try {
      const entries = await readdir(coversDir)
      const match = entries.find((name) => name.startsWith(`${coverId}.`))
      if (!match) return null
      const filePath = join(coversDir, match)
      const ext = extname(match).toLowerCase()
      return { filePath, contentType: MIME_MAP[ext] ?? 'image/jpeg' }
    } catch {
      return null
    }
  }

  private async resolveProvider(source: any): Promise<IProviderStrategy | null> {
    const firstChapter = source.chapters?.[0]
    if (!firstChapter?.url) return null
    const { ProviderResolver } = await import('../../scraping/providers/provider-resolver')
    const resolver = new ProviderResolver()
    return resolver.resolve(firstChapter.url)
  }
}
