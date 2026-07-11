import path from 'node:path'
import fs from 'node:fs/promises'
import { env } from '../../../shared/config/env'
import { mkdirp, readJson, writeJson } from '../../../shared/utils/filesystem'
import type { SourceCacheRepository } from './source-cache.repository'
import type { SourceMetadataFile } from '../types/metadata.types'
import type { MetadataCache } from '../types/metadata.types'

function sourceDir(sourceId: string): string {
  return path.join(env.STORAGE_PATH, 'sources', sourceId)
}

function metadataPath(sourceId: string): string {
  return path.join(sourceDir(sourceId), 'metadata.json')
}

/**
 * Implementação concreta do repositório usando o filesystem local.
 *
 * Estrutura em disco:
 *   storage/sources/{sourceId}/
 *     ├── metadata.json
 *     ├── covers/
 *     └── chapters/
 */
export class FilesystemSourceRepository implements SourceCacheRepository {
  async exists(sourceId: string): Promise<boolean> {
    try {
      await fs.access(metadataPath(sourceId))
      return true
    } catch {
      return false
    }
  }

  async load(sourceId: string): Promise<SourceMetadataFile | null> {
    return readJson<SourceMetadataFile>(metadataPath(sourceId))
  }

  async save(sourceId: string, data: SourceMetadataFile): Promise<void> {
    const dir = sourceDir(sourceId)

    // Cria estrutura de diretórios
    await mkdirp(path.join(dir, 'covers'))
    await mkdirp(path.join(dir, 'chapters'))

    // Substitui completamente o metadata.json
    await writeJson(metadataPath(sourceId), data)
  }

  async update(sourceId: string, patch: Partial<MetadataCache>): Promise<void> {
    const current = await this.load(sourceId)
    if (!current) return

    const updated: SourceMetadataFile = {
      ...current,
      cache: {
        ...current.cache,
        ...patch,
      },
    }

    await writeJson(metadataPath(sourceId), updated)
  }

  async delete(sourceId: string): Promise<void> {
    try {
      await fs.rm(sourceDir(sourceId), { recursive: true, force: true })
    } catch {
      // Silently ignore if already deleted
    }
  }
}
