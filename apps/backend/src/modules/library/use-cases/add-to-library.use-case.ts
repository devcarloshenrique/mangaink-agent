import type { LibraryRepository } from '../repositories/library.repository'
import type { SourceCacheRepository } from '../../scraping/repositories/source-cache.repository'
import { SourceNotFoundError } from '../../scraping/errors/scraping.errors'
import type { UserLibrary } from '../types/library.types'

interface AddToLibraryInput {
  userId: string
  sourceId: string
}

export class AddToLibraryUseCase {
  constructor(
    private readonly libraryRepository: LibraryRepository,
    private readonly sourceRepository: SourceCacheRepository,
  ) {}

  async execute(input: AddToLibraryInput): Promise<UserLibrary> {
    const sourceExists = await this.sourceRepository.exists(input.sourceId)
    if (!sourceExists) {
      throw new SourceNotFoundError(input.sourceId)
    }

    return this.libraryRepository.add(input.userId, input.sourceId)
  }
}
