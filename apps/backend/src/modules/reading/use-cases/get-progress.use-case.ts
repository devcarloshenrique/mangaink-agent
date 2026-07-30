import type { UserChapterProgressRepository } from '../repositories/user-chapter-progress.repository'
import type { SourceCacheRepository } from '../../scraping/repositories/source-cache.repository'
import type { ReadingProgress } from '../types/reading.types'
import { SourceNotFoundError } from '../../scraping/errors/scraping.errors'

interface GetProgressInput {
  userId: string
  sourceId: string
}

export class GetProgressUseCase {
  constructor(
    private readonly readingRepository: UserChapterProgressRepository,
    private readonly sourceRepository: SourceCacheRepository,
  ) {}

  async execute(input: GetProgressInput): Promise<ReadingProgress> {
    const [records, source] = await Promise.all([
      this.readingRepository.findByUserAndSource(input.userId, input.sourceId),
      this.sourceRepository.load(input.sourceId),
    ])

    if (!source) {
      throw new SourceNotFoundError(input.sourceId)
    }

    const totalChapters = source.chapters.length
    const readChapterIds = records.map((r) => r.chapterId)
    const lastReadAt =
      records.length > 0
        ? records.reduce(
            (max, r) => (r.readAt > max ? r.readAt : max),
            records[0].readAt,
          ).toISOString()
        : null

    return {
      sourceId: input.sourceId,
      readChapterIds,
      totalRead: readChapterIds.length,
      totalChapters,
      lastReadAt,
    }
  }
}
