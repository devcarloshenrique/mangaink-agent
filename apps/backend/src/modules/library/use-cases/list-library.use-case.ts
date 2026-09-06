import type { LibraryRepository } from '../repositories/library.repository'
import type { ListLibraryResponse } from '../dtos/library.dto'

interface ListLibraryInput {
  userId: string
  isFavorite?: boolean
  query?: string
}

export class ListLibraryUseCase {
  constructor(private readonly libraryRepository: LibraryRepository) {}

  async execute(input: ListLibraryInput): Promise<ListLibraryResponse> {
    const items = await this.libraryRepository.listByUser(input.userId, {
      isFavorite: input.isFavorite,
      query: input.query,
    })

    return {
      items: items.map((item) => ({
        id: item.id,
        userId: item.userId,
        sourceId: item.sourceId,
        title: item.title,
        author: item.author,
        coverUrl: item.coverUrl,
        chaptersCount: item.chaptersCount,
        isFavorite: item.isFavorite,
        createdAt: typeof item.createdAt === 'string' ? item.createdAt : item.createdAt.toISOString(),
        updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : item.updatedAt.toISOString(),
      })),
      total: items.length,
    }
  }
}
