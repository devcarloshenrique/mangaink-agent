import { describe, it, expect, vi } from 'vitest'
import { UnmarkReadUseCase } from '../use-cases/unmark-read.use-case'
import type { UserChapterProgressRepository } from '../repositories/user-chapter-progress.repository'

function createMockRepo() {
  const records = new Map<string, { userId: string; sourceId: string; chapterId: string }>()

  const key = (userId: string, sourceId: string, chapterId: string) =>
    `${userId}:${sourceId}:${chapterId}`

  const repo: UserChapterProgressRepository = {
    findByUserAndSource: vi.fn(),
    findByUserAndSourceAndChapter: vi.fn(async (userId, sourceId, chapterId) => {
      return records.has(key(userId, sourceId, chapterId))
        ? ({ userId, sourceId, chapterId } as unknown as any)
        : null
    }),
    create: vi.fn(),
    delete: vi.fn(async (userId, sourceId, chapterId) => {
      records.delete(key(userId, sourceId, chapterId))
    }),
    createMany: vi.fn(),
    deleteMany: vi.fn(),
    getLastReadAt: vi.fn(),
    countByUserAndSource: vi.fn(),
  }

  return { repo, records }
}

describe('UnmarkReadUseCase', () => {
  it('deve desmarcar capítulo que estava lido', async () => {
    const { repo, records } = createMockRepo()
    const useCase = new UnmarkReadUseCase(repo)

    records.set('user-1:src:chap', { userId: 'user-1', sourceId: 'src', chapterId: 'chap' })

    const result = await useCase.execute({
      userId: 'user-1',
      sourceId: 'src',
      chapterId: 'chap',
    })

    expect(result).toEqual({ isRead: false })
    expect(repo.delete).toHaveBeenCalledWith('user-1', 'src', 'chap')
  })

  it('deve ser idempotente ao desmarcar capítulo já não lido', async () => {
    const { repo } = createMockRepo()
    const useCase = new UnmarkReadUseCase(repo)

    const result = await useCase.execute({
      userId: 'user-1',
      sourceId: 'src',
      chapterId: 'chap',
    })

    expect(result).toEqual({ isRead: false })
    expect(repo.delete).toHaveBeenCalledTimes(0)
  })
})
