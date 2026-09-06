import type { LibraryItem, UserLibrary } from '../types/library.types'
import type { LibraryRepository } from './library.repository'
import { getPrisma } from '../../../shared/database/prisma'

export class PrismaLibraryRepository implements LibraryRepository {
  async listByUser(
    userId: string,
    options?: { isFavorite?: boolean; query?: string },
  ): Promise<LibraryItem[]> {
    const rows = await getPrisma().userLibrary.findMany({
      where: {
        userId,
        ...(options?.isFavorite !== undefined ? { isFavorite: options.isFavorite } : {}),
      },
      include: {
        source: {
          include: {
            covers: true,
            _count: {
              select: {
                chapters: true,
              },
            },
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    })

    let items: LibraryItem[] = rows.map((row) => {
      const meta = (row.source?.metadata as { title?: string; author?: string | null } | undefined) ?? {}
      const originalCover =
        row.source?.covers?.find((c) => c.type === 'original') ?? row.source?.covers?.[0]

      return {
        id: row.id,
        userId: row.userId,
        sourceId: row.sourceId,
        title: meta.title ?? 'Sem título',
        author: meta.author ?? null,
        coverUrl: originalCover?.imageUrl ?? null,
        chaptersCount: row.source?._count?.chapters ?? 0,
        isFavorite: row.isFavorite,
        createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
        updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
      }
    })

    if (options?.query) {
      const q = options.query.toLowerCase()
      items = items.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          (item.author && item.author.toLowerCase().includes(q)),
      )
    }

    return items
  }

  async findByUserAndSource(userId: string, sourceId: string): Promise<UserLibrary | null> {
    const row = await getPrisma().userLibrary.findUnique({
      where: {
        userId_sourceId: {
          userId,
          sourceId,
        },
      },
    })

    if (!row) return null

    return {
      id: row.id,
      userId: row.userId,
      sourceId: row.sourceId,
      isFavorite: row.isFavorite,
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
      updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
    }
  }

  async add(userId: string, sourceId: string): Promise<UserLibrary> {
    const row = await getPrisma().userLibrary.upsert({
      where: {
        userId_sourceId: {
          userId,
          sourceId,
        },
      },
      create: {
        userId,
        sourceId,
        isFavorite: false,
      },
      update: {},
    })

    return {
      id: row.id,
      userId: row.userId,
      sourceId: row.sourceId,
      isFavorite: row.isFavorite,
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
      updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
    }
  }

  async remove(userId: string, sourceId: string): Promise<void> {
    await getPrisma().userLibrary.deleteMany({
      where: {
        userId,
        sourceId,
      },
    })
  }

  async setFavorite(userId: string, sourceId: string, isFavorite: boolean): Promise<UserLibrary> {
    const row = await getPrisma().userLibrary.upsert({
      where: {
        userId_sourceId: {
          userId,
          sourceId,
        },
      },
      create: {
        userId,
        sourceId,
        isFavorite,
      },
      update: {
        isFavorite,
      },
    })

    return {
      id: row.id,
      userId: row.userId,
      sourceId: row.sourceId,
      isFavorite: row.isFavorite,
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
      updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
    }
  }
}
