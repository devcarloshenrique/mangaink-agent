import type { UserChapterProgressRepository } from '../repositories/user-chapter-progress.repository'

interface UnmarkReadInput {
  userId: string
  sourceId: string
  chapterId: string
}

interface UnmarkReadOutput {
  isRead: false
}

export class UnmarkReadUseCase {
  constructor(private readonly repository: UserChapterProgressRepository) {}

  async execute(input: UnmarkReadInput): Promise<UnmarkReadOutput> {
    const existing = await this.repository.findByUserAndSourceAndChapter(
      input.userId,
      input.sourceId,
      input.chapterId,
    )

    if (existing) {
      await this.repository.delete(input.userId, input.sourceId, input.chapterId)
    }

    return { isRead: false }
  }
}
