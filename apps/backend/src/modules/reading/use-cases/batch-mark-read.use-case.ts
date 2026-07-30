import type { UserChapterProgressRepository } from '../repositories/user-chapter-progress.repository'
import type { BatchMarkReadInput, BatchMarkReadResult } from '../types/reading.types'

interface ExecuteInput extends BatchMarkReadInput {
  userId: string
  sourceId: string
}

export class BatchMarkReadUseCase {
  constructor(private readonly repository: UserChapterProgressRepository) {}

  async execute(input: ExecuteInput): Promise<BatchMarkReadResult> {
    if (input.chapterIds.length === 0) {
      throw new Error('chapterIds não pode estar vazio')
    }

    let updatedCount: number

    if (input.markAsRead) {
      updatedCount = await this.repository.createMany(
        input.userId,
        input.sourceId,
        input.chapterIds,
      )
    } else {
      updatedCount = await this.repository.deleteMany(
        input.userId,
        input.sourceId,
        input.chapterIds,
      )
    }

    const currentRecords = await this.repository.findByUserAndSource(
      input.userId,
      input.sourceId,
    )

    return {
      updatedCount,
      readChapterIds: currentRecords.map((r) => r.chapterId),
    }
  }
}
