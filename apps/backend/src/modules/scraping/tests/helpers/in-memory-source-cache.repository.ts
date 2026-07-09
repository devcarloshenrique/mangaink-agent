import type { SourceCacheRepository } from '../../repositories/source-cache.repository'
import type { SourceMetadataFile } from '../../types/metadata.types'
import type { MetadataCache } from '../../types/metadata.types'

export class InMemorySourceCacheRepository implements SourceCacheRepository {
  private store = new Map<string, SourceMetadataFile>()

  async exists(sourceId: string): Promise<boolean> {
    return this.store.has(sourceId)
  }

  async load(sourceId: string): Promise<SourceMetadataFile | null> {
    return this.store.get(sourceId) ?? null
  }

  async save(sourceId: string, data: SourceMetadataFile): Promise<void> {
    this.store.set(sourceId, data)
  }

  async update(sourceId: string, patch: Partial<MetadataCache>): Promise<void> {
    const current = this.store.get(sourceId)
    if (!current) return

    this.store.set(sourceId, {
      ...current,
      cache: { ...current.cache, ...patch },
    })
  }

  async delete(sourceId: string): Promise<void> {
    this.store.delete(sourceId)
  }

  reset(): void {
    this.store.clear()
  }
}