import type { SourceCacheRepository } from '../../repositories/source-cache.repository'
import type { SourceMetadataFile } from '../../types/metadata.types'
import type { MetadataCache } from '../../types/metadata.types'

export class InMemorySourceCacheRepository implements SourceCacheRepository {
  private store = new Map<string, SourceMetadataFile>()
  private placeholderStore = new Map<string, number[]>()

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

  async getPlaceholderIndices(sourceId: string, chapterId: string): Promise<number[]> {
    const key = `${sourceId}:${chapterId}`
    return this.placeholderStore.get(key) ?? []
  }

  async updatePlaceholderIndices(sourceId: string, chapterId: string, indices: number[]): Promise<void> {
    const key = `${sourceId}:${chapterId}`
    this.placeholderStore.set(key, indices)
  }

  async updateChapterUnavailableReason(sourceId: string, chapterId: string, reason: string | null): Promise<void> {
    const file = this.store.get(sourceId)
    if (!file) return
    const ch = file.chapters.find((c) => c.id === chapterId)
    if (ch) {
      ch.unavailableReason = reason
    }
  }

  reset(): void {
    this.store.clear()
    this.placeholderStore.clear()
  }
}