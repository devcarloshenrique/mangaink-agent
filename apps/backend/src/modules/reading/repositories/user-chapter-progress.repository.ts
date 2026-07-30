import type { UserChapterProgress } from '@prisma/client'

export interface UserChapterProgressRepository {
  findByUserAndSource(userId: string, sourceId: string): Promise<UserChapterProgress[]>
  findByUserAndSourceAndChapter(
    userId: string,
    sourceId: string,
    chapterId: string,
  ): Promise<UserChapterProgress | null>
  create(data: { userId: string; sourceId: string; chapterId: string }): Promise<UserChapterProgress>
  delete(userId: string, sourceId: string, chapterId: string): Promise<void>
  createMany(userId: string, sourceId: string, chapterIds: string[]): Promise<number>
  deleteMany(userId: string, sourceId: string, chapterIds: string[]): Promise<number>
  getLastReadAt(userId: string, sourceId: string): Promise<Date | null>
  countByUserAndSource(userId: string, sourceId: string): Promise<number>
}
