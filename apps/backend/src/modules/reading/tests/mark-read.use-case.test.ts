import { describe, it, expect, vi } from 'vitest'
import { MarkReadUseCase } from '../use-cases/mark-read.use-case'
import type { UserChapterProgressRepository } from '../repositories/user-chapter-progress.repository'

function createMockRepo() {
  const records = new Map<string, { userId: string; sourceId: string; chapterId: string; readAt: Date }>()

  const key = (userId: string, sourceId: string, chapterId: string) =>
    `${userId}:${sourceId}:${chapterId}`

  const repo: UserChapterProgressRepository = {
    findByUserAndSource: vi.fn(),
    findByUserAndSourceAndChapter: vi.fn(async (userId, sourceId, chapterId) => {
      const record = records.get(key(userId, sourceId, chapterId))
      return record
        ? ({ userId, sourceId, chapterId, readAt: record.readAt } as unknown as any)
        : null
    }),
    create: vi.fn(async (data) => {
      records.set(key(data.userId, data.sourceId, data.chapterId), {
        ...data,
        readAt: new Date(),
      })
      return { ...data, readAt: new Date() } as unknown as any
    }),
    delete: vi.fn(),
    createMany: vi.fn(),
    deleteMany: vi.fn(),
    getLastReadAt: vi.fn(),
    countByUserAndSource: vi.fn(),
  }

  return { repo, records }
}

describe('MarkReadUseCase', () => {
  it('deve marcar capítulo como lido pela primeira vez', async () => {
    const { repo } = createMockRepo()
    const useCase = new MarkReadUseCase(repo)

    const result = await useCase.execute({
      userId: 'user-1',
      sourceId: 'source-abc',
      chapterId: 'chap-001',
    })

    expect(result).toEqual({ isRead: true })
    expect(repo.create).toHaveBeenCalledWith({
      userId: 'user-1',
      sourceId: 'source-abc',
      chapterId: 'chap-001',
    })
  })

  it('deve ser idempotente ao marcar capítulo já lido', async () => {
    const { repo } = createMockRepo()
    const useCase = new MarkReadUseCase(repo)

    await useCase.execute({ userId: 'user-1', sourceId: 'source-abc', chapterId: 'chap-001' })
    // Segunda chamada — já existe
    const result = await useCase.execute({ userId: 'user-1', sourceId: 'source-abc', chapterId: 'chap-001' })

    expect(result).toEqual({ isRead: true })
    expect(repo.create).toHaveBeenCalledTimes(1)
  })

  it('deve lançar erro se source não existe', async () => {
    const { repo } = createMockRepo()
    repo.findByUserAndSourceAndChapter = vi.fn().mockRejectedValue(
      new Error('Source not found'),
    )

    const useCase = new MarkReadUseCase(repo)

    await expect(
      useCase.execute({ userId: 'user-1', sourceId: 'invalid', chapterId: 'chap-001' }),
    ).rejects.toThrow('Source not found')
  })
})
