import type { UserChapterProgress } from '@prisma/client'
import { Prisma } from '@prisma/client'
import { getPrisma } from '../../../shared/database/prisma'
import type { UserChapterProgressRepository } from './user-chapter-progress.repository'

export class PrismaUserChapterProgressRepository implements UserChapterProgressRepository {
  async findByUserAndSource(userId: string, sourceId: string): Promise<UserChapterProgress[]> {
    return getPrisma().userChapterProgress.findMany({
      where: { userId, sourceId },
    })
  }

  async findByUserAndSourceAndChapter(
    userId: string,
    sourceId: string,
    chapterId: string,
  ): Promise<UserChapterProgress | null> {
    return getPrisma().userChapterProgress.findUnique({
      where: {
        userId_sourceId_chapterId: { userId, sourceId, chapterId },
      },
    })
  }

  async create(data: {
    userId: string
    sourceId: string
    chapterId: string
  }): Promise<UserChapterProgress> {
    try {
      return await getPrisma().userChapterProgress.create({ data })
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return getPrisma().userChapterProgress.findUniqueOrThrow({
          where: {
            userId_sourceId_chapterId: data,
          },
        })
      }
      throw error
    }
  }

  async delete(userId: string, sourceId: string, chapterId: string): Promise<void> {
    await getPrisma().userChapterProgress.deleteMany({
      where: { userId, sourceId, chapterId },
    })
  }

  async createMany(
    userId: string,
    sourceId: string,
    chapterIds: string[],
  ): Promise<number> {
    const result = await getPrisma().userChapterProgress.createMany({
      data: chapterIds.map((chapterId) => ({ userId, sourceId, chapterId })),
      skipDuplicates: true,
    })
    return result.count
  }

  async deleteMany(
    userId: string,
    sourceId: string,
    chapterIds: string[],
  ): Promise<number> {
    const result = await getPrisma().userChapterProgress.deleteMany({
      where: { userId, sourceId, chapterId: { in: chapterIds } },
    })
    return result.count
  }

  async getLastReadAt(userId: string, sourceId: string): Promise<Date | null> {
    const record = await getPrisma().userChapterProgress.findFirst({
      where: { userId, sourceId },
      orderBy: { readAt: 'desc' },
      select: { readAt: true },
    })
    return record?.readAt ?? null
  }

  async countByUserAndSource(userId: string, sourceId: string): Promise<number> {
    return getPrisma().userChapterProgress.count({
      where: { userId, sourceId },
    })
  }
}
