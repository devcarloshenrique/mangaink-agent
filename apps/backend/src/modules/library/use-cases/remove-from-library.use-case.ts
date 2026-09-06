import type { LibraryRepository } from '../repositories/library.repository'
import type { RemoveFromLibraryResponse } from '../dtos/library.dto'

interface RemoveFromLibraryInput {
  userId: string
  sourceId: string
}

export class RemoveFromLibraryUseCase {
  constructor(private readonly libraryRepository: LibraryRepository) {}

  async execute(input: RemoveFromLibraryInput): Promise<RemoveFromLibraryResponse> {
    await this.libraryRepository.remove(input.userId, input.sourceId)
    return { success: true }
  }
}
