import { describe, it, expect, vi } from 'vitest'
import { GetProgressUseCase } from '../use-cases/get-progress.use-case'
import type { UserChapterProgressRepository } from '../repositories/user-chapter-progress.repository'
import type { SourceCacheRepository } from '../../scraping/repositories/source-cache.repository'

function createMockRepo() {
  const records: { userId: string; sourceId: string; chapterId: string; readAt: Date }[] = []

  const repo: UserChapterProgressRepository = {
    findByUserAndSource: vi.fn(async (userId, sourceId) => {
      return records.filter((r) => r.userId === userId && r.sourceId === sourceId) as any
    }),
    findByUserAndSourceAndChapter: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    createMany: vi.fn(),
    deleteMany: vi.fn(),
    getLastReadAt: vi.fn(async (userId, sourceId) => {
      const userRecords = records.filter((r) => r.userId === userId && r.sourceId === sourceId)
      if (userRecords.length === 0) return null
      return userRecords.reduce((max, r) => (r.readAt > max ? r.readAt : max), userRecords[0].readAt)
    }),
    countByUserAndSource: vi.fn(async (userId, sourceId) => {
      return records.filter((r) => r.userId === userId && r.sourceId === sourceId).length
    }),
  }

  return { repo, records }
}

function createMockSourceRepo(totalChapters: number) {
  return {
    exists: vi.fn(),
    load: vi.fn(async () => ({
      sourceId: 'source-abc',
      chapters: Array.from({ length: totalChapters }, (_, i) => ({ id: `chap-${i + 1}` })),
    })),
    save: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getPlaceholderIndices: vi.fn(),
    updatePlaceholderIndices: vi.fn(),
  } as unknown as SourceCacheRepository
}

describe('GetProgressUseCase', () => {
  it('deve retornar progresso vazio quando nenhum capítulo lido', async () => {
    const { repo } = createMockRepo()
    const sourceRepo = createMockSourceRepo(10)
    const useCase = new GetProgressUseCase(repo, sourceRepo)

    const result = await useCase.execute({ userId: 'user-1', sourceId: 'source-abc' })

    expect(result).toEqual({
      sourceId: 'source-abc',
      readChapterIds: [],
      totalRead: 0,
      totalChapters: 10,
      lastReadAt: null,
    })
  })

  it('deve retornar progresso parcial quando alguns capítulos lidos', async () => {
    const { repo, records } = createMockRepo()
    const sourceRepo = createMockSourceRepo(10)

    records.push(
      { userId: 'user-1', sourceId: 'source-abc', chapterId: 'chap-1', readAt: new Date('2026-01-01') },
      { userId: 'user-1', sourceId: 'source-abc', chapterId: 'chap-3', readAt: new Date('2026-01-03') },
      { userId: 'user-1', sourceId: 'source-abc', chapterId: 'chap-5', readAt: new Date('2026-01-02') },
    )

    const useCase = new GetProgressUseCase(repo, sourceRepo)

    const result = await useCase.execute({ userId: 'user-1', sourceId: 'source-abc' })

    expect(result.totalRead).toBe(3)
    expect(result.readChapterIds).toEqual(['chap-1', 'chap-3', 'chap-5'])
    expect(result.totalChapters).toBe(10)
    expect(result.lastReadAt).toBe(new Date('2026-01-03').toISOString())
  })

  it('deve retornar progresso completo com todos os capítulos lidos', async () => {
    const { repo, records } = createMockRepo()
    const sourceRepo = createMockSourceRepo(3)

    records.push(
      { userId: 'user-1', sourceId: 'source-abc', chapterId: 'chap-1', readAt: new Date() },
      { userId: 'user-1', sourceId: 'source-abc', chapterId: 'chap-2', readAt: new Date() },
      { userId: 'user-1', sourceId: 'source-abc', chapterId: 'chap-3', readAt: new Date() },
    )

    const useCase = new GetProgressUseCase(repo, sourceRepo)

    const result = await useCase.execute({ userId: 'user-1', sourceId: 'source-abc' })

    expect(result.totalRead).toBe(3)
    expect(result.totalChapters).toBe(3)
  })
})
