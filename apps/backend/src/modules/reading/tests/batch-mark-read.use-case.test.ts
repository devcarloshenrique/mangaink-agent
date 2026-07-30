import { describe, it, expect, vi } from 'vitest'
import { BatchMarkReadUseCase } from '../use-cases/batch-mark-read.use-case'
import type { UserChapterProgressRepository } from '../repositories/user-chapter-progress.repository'

function createMockRepo() {
  const repo: UserChapterProgressRepository = {
    findByUserAndSource: vi.fn(async () => []),
    findByUserAndSourceAndChapter: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    createMany: vi.fn(async () => 3),
    deleteMany: vi.fn(async () => 2),
    getLastReadAt: vi.fn(),
    countByUserAndSource: vi.fn(),
  }

  return { repo }
}

describe('BatchMarkReadUseCase', () => {
  it('deve marcar múltiplos capítulos como lidos', async () => {
    const { repo } = createMockRepo()
    const useCase = new BatchMarkReadUseCase(repo)

    const result = await useCase.execute({
      userId: 'user-1',
      sourceId: 'source-abc',
      chapterIds: ['chap-1', 'chap-2', 'chap-3'],
      markAsRead: true,
    })

    expect(result.updatedCount).toBe(3)
    expect(repo.createMany).toHaveBeenCalledWith('user-1', 'source-abc', [
      'chap-1',
      'chap-2',
      'chap-3',
    ])
    expect(repo.deleteMany).not.toHaveBeenCalled()
  })

  it('deve desmarcar múltiplos capítulos', async () => {
    const { repo } = createMockRepo()
    const useCase = new BatchMarkReadUseCase(repo)

    const result = await useCase.execute({
      userId: 'user-1',
      sourceId: 'source-abc',
      chapterIds: ['chap-1', 'chap-2'],
      markAsRead: false,
    })

    expect(result.updatedCount).toBe(2)
    expect(repo.deleteMany).toHaveBeenCalledWith('user-1', 'source-abc', [
      'chap-1',
      'chap-2',
    ])
    expect(repo.createMany).not.toHaveBeenCalled()
  })

  it('deve lançar erro quando lista de capítulos está vazia', async () => {
    const { repo } = createMockRepo()
    const useCase = new BatchMarkReadUseCase(repo)

    await expect(
      useCase.execute({
        userId: 'user-1',
        sourceId: 'source-abc',
        chapterIds: [],
        markAsRead: true,
      }),
    ).rejects.toThrow('chapterIds não pode estar vazio')
  })
})
