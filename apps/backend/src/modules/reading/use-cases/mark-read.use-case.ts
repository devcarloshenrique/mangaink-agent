import type { UserChapterProgressRepository } from '../repositories/user-chapter-progress.repository'

interface MarkReadInput {
  userId: string
  sourceId: string
  chapterId: string
}

interface MarkReadOutput {
  isRead: true
}

export class MarkReadUseCase {
  constructor(private readonly repository: UserChapterProgressRepository) {}

  async execute(input: MarkReadInput): Promise<MarkReadOutput> {
    const existing = await this.repository.findByUserAndSourceAndChapter(
      input.userId,
      input.sourceId,
      input.chapterId,
    )

    if (!existing) {
      await this.repository.create({
        userId: input.userId,
        sourceId: input.sourceId,
        chapterId: input.chapterId,
      })
    }

    return { isRead: true }
  }
}
