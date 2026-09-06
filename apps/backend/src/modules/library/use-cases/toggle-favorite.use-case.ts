import type { LibraryRepository } from '../repositories/library.repository'
import type { SourceCacheRepository } from '../../scraping/repositories/source-cache.repository'
import { SourceNotFoundError } from '../../scraping/errors/scraping.errors'
import type { UserLibrary } from '../types/library.types'

interface ToggleFavoriteInput {
  userId: string
  sourceId: string
  isFavorite?: boolean
}

export class ToggleFavoriteUseCase {
  constructor(
    private readonly libraryRepository: LibraryRepository,
    private readonly sourceRepository: SourceCacheRepository,
  ) {}

  async execute(input: ToggleFavoriteInput): Promise<UserLibrary> {
    const sourceExists = await this.sourceRepository.exists(input.sourceId)
    if (!sourceExists) {
      throw new SourceNotFoundError(input.sourceId)
    }

    let targetFavoriteState: boolean
    if (input.isFavorite !== undefined) {
      targetFavoriteState = input.isFavorite
    } else {
      const existing = await this.libraryRepository.findByUserAndSource(input.userId, input.sourceId)
      targetFavoriteState = existing ? !existing.isFavorite : true
    }

    return this.libraryRepository.setFavorite(input.userId, input.sourceId, targetFavoriteState)
  }
}
