import type { LibraryItem, UserLibrary } from '../types/library.types'
import type { LibraryRepository } from '../repositories/library.repository'

export class InMemoryLibraryRepository implements LibraryRepository {
  public records: (UserLibrary & { title?: string; author?: string | null; coverUrl?: string | null; chaptersCount?: number })[] = []
  private idCounter = 1

  async listByUser(userId: string, options?: { isFavorite?: boolean; query?: string }): Promise<LibraryItem[]> {
    return this.records
      .filter((r) => {
        if (r.userId !== userId) return false
        if (options?.isFavorite !== undefined && r.isFavorite !== options.isFavorite) return false
        if (options?.query) {
          const q = options.query.toLowerCase()
          const matchesTitle = r.title?.toLowerCase().includes(q)
          const matchesAuthor = r.author?.toLowerCase().includes(q)
          if (!matchesTitle && !matchesAuthor) return false
        }
        return true
      })
      .map((r) => ({
        id: r.id,
        userId: r.userId,
        sourceId: r.sourceId,
        title: r.title ?? 'Untitled',
        author: r.author ?? null,
        coverUrl: r.coverUrl ?? null,
        chaptersCount: r.chaptersCount ?? 0,
        isFavorite: r.isFavorite,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      }))
  }

  async findByUserAndSource(userId: string, sourceId: string): Promise<UserLibrary | null> {
    const found = this.records.find((r) => r.userId === userId && r.sourceId === sourceId)
    if (!found) return null
    return {
      id: found.id,
      userId: found.userId,
      sourceId: found.sourceId,
      isFavorite: found.isFavorite,
      createdAt: found.createdAt,
      updatedAt: found.updatedAt,
    }
  }

  async add(userId: string, sourceId: string): Promise<UserLibrary> {
    const existing = await this.findByUserAndSource(userId, sourceId)
    if (existing) return existing

    const now = new Date()
    const record = {
      id: `00000000-0000-4000-8000-${String(this.idCounter++).padStart(12, '0')}`,
      userId,
      sourceId,
      isFavorite: false,
      createdAt: now,
      updatedAt: now,
    }
    this.records.push(record)
    return {
      id: record.id,
      userId: record.userId,
      sourceId: record.sourceId,
      isFavorite: record.isFavorite,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    }
  }

  async remove(userId: string, sourceId: string): Promise<void> {
    this.records = this.records.filter((r) => !(r.userId === userId && r.sourceId === sourceId))
  }

  async setFavorite(userId: string, sourceId: string, isFavorite: boolean): Promise<UserLibrary> {
    let found = this.records.find((r) => r.userId === userId && r.sourceId === sourceId)
    if (!found) {
      const now = new Date()
      found = {
        id: `00000000-0000-4000-8000-${String(this.idCounter++).padStart(12, '0')}`,
        userId,
        sourceId,
        isFavorite,
        createdAt: now,
        updatedAt: now,
      }
      this.records.push(found)
    } else {
      found.isFavorite = isFavorite
      found.updatedAt = new Date()
    }

    return {
      id: found.id,
      userId: found.userId,
      sourceId: found.sourceId,
      isFavorite: found.isFavorite,
      createdAt: found.createdAt,
      updatedAt: found.updatedAt,
    }
  }
}
