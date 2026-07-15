import { describe, expect, it, beforeEach, vi } from 'vitest'

const mockRepo = vi.hoisted(() => {
  const store = new Map<string, any>()
  return {
    reset: () => store.clear(),
    exists: async (id: string) => store.has(id),
    load: async (id: string) => store.get(id) ?? null,
    save: async (id: string, data: any) => { store.set(id, data) },
    update: async (id: string, patch: any) => {
      const current = store.get(id)
      if (current) store.set(id, { ...current, cache: { ...current.cache, ...patch } })
    },
    delete: async (id: string) => { store.delete(id) },
    getPlaceholderIndices: vi.fn().mockResolvedValue([]),
    updatePlaceholderIndices: vi.fn(),
  }
})

vi.mock('../../../../shared/database/repositories', async () => {
  const actual = await vi.importActual<typeof import('../../../../shared/database/repositories')>('../../../../shared/database/repositories')
  return {
    ...actual,
    getSourceRepository: vi.fn(() => mockRepo),
  }
})

import { GetSourceUseCase } from '../../use-cases/get-source.use-case'

describe('GetSourceUseCase', () => {
  let useCase: GetSourceUseCase

  beforeEach(() => {
    mockRepo.reset()
    useCase = new GetSourceUseCase()
  })

  it('deve retornar dados completos quando source existe', async () => {
    const now = new Date().toISOString()
    await mockRepo.save('src-test-12345678', {
      sourceId: 'src-test-12345678',
      status: 'ready',
      provider: { slug: 'test', name: 'Test', engine: 'cheerio' },
      source: { url: 'https://example.com/manga/test/', language: null },
      metadata: {
        title: 'Test Manga',
        author: 'Author',
        description: 'Description',
        status: 'ongoing',
        genres: ['Action'],
      },
      chapters: [
        { id: 'chap_0001', number: '1', title: 'Chapter 1', url: 'https://example.com/chap-1/', pages: null, volume: null },
      ],
      covers: [
        { id: 'cover_001', type: 'original', label: 'Original', imageUrl: 'https://example.com/cover.jpg' },
      ],
      statistics: { chapters: 1, covers: 1 },
      cache: {
        createdAt: now,
        updatedAt: now,
        lastAccessAt: now,
        cacheTtlHours: 24,
        retentionDays: 30,
      },
    })

    const result = await useCase.execute('src-test-12345678')
    expect(result.sourceId).toBe('src-test-12345678')
    expect(result.status).toBe('ready')
    expect(result.metadata.title).toBe('Test Manga')
    expect(result.chapters).toHaveLength(1)
    expect(result.covers).toHaveLength(1)
    expect(result.statistics.chapters).toBe(1)
  })

  it('deve remover campo cache da resposta', async () => {
    const now = new Date().toISOString()
    await mockRepo.save('src-test-12345678', {
      sourceId: 'src-test-12345678',
      status: 'ready',
      provider: { slug: 'test', name: 'Test', engine: 'cheerio' },
      source: { url: 'https://example.com/manga/test/', language: null },
      metadata: { title: 'Test', author: null, description: null, status: null, genres: [] },
      chapters: [],
      covers: [],
      statistics: { chapters: 0, covers: 0 },
      cache: {
        createdAt: now,
        updatedAt: now,
        lastAccessAt: now,
        cacheTtlHours: 24,
        retentionDays: 30,
      },
    })

    const result = await useCase.execute('src-test-12345678')
    expect(result).not.toHaveProperty('cache')
  })

  it('deve lançar erro quando source não existe', async () => {
    await expect(useCase.execute('src-nonexistent')).rejects.toThrow('Source não encontrada')
  })
})
