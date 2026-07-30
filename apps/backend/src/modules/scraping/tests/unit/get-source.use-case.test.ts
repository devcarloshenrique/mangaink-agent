import { describe, expect, it, beforeEach, vi } from 'vitest'
import { GetSourceUseCase } from '../../use-cases/get-source.use-case'
import type { UserChapterProgressRepository } from '../../../reading/repositories/user-chapter-progress.repository'

const mockRepo = {
  store: new Map<string, any>(),
  reset() {
    this.store.clear()
  },
  exists: async (id: string) => mockRepo.store.has(id),
  load: async (id: string) => mockRepo.store.get(id) ?? null,
  save: async (id: string, data: any) => {
    mockRepo.store.set(id, data)
  },
  update: async (_id: string, _patch: any) => {},
  delete: async (id: string) => {
    mockRepo.store.delete(id)
  },
  getPlaceholderIndices: vi.fn().mockResolvedValue([]),
  updatePlaceholderIndices: vi.fn(),
}

function createReadingRepo(readIds: string[] = []): UserChapterProgressRepository {
  return {
    findByUserAndSource: vi
      .fn()
      .mockResolvedValue(
        readIds.map((id) => ({
          userId: 'user-1',
          sourceId: 'src-1',
          chapterId: id,
          readAt: new Date(),
          id: '',
          createdAt: new Date(),
        })),
      ),
    findByUserAndSourceAndChapter: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    createMany: vi.fn(),
    deleteMany: vi.fn(),
    getLastReadAt: vi.fn(),
    countByUserAndSource: vi.fn(),
  }
}

describe('GetSourceUseCase', () => {
  let useCase: GetSourceUseCase

  beforeEach(() => {
    mockRepo.reset()
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
        {
          id: 'chap_0001',
          number: '1',
          title: 'Chapter 1',
          url: 'https://example.com/chap-1/',
          pages: null,
          volume: null,
          isDownloaded: false,
        },
      ],
      covers: [
        {
          id: 'cover_001',
          type: 'original',
          label: 'Original',
          imageUrl: 'https://example.com/cover.jpg',
        },
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

    useCase = new GetSourceUseCase(mockRepo as any)
    const result = await useCase.execute('src-test-12345678')
    expect(result.sourceId).toBe('src-test-12345678')
    expect(result.status).toBe('ready')
    expect(result.metadata.title).toBe('Test Manga')
    expect(result.chapters).toHaveLength(1)
    expect(result.covers).toHaveLength(1)
    expect(result.statistics.chapters).toBe(1)
    expect(typeof result.chapters[0].isDownloaded).toBe('boolean')
    expect(result.chapters[0].isRead).toBe(false)
  })

  it('deve remover campo cache da resposta', async () => {
    const now = new Date().toISOString()
    await mockRepo.save('src-test-12345678', {
      sourceId: 'src-test-12345678',
      status: 'ready',
      provider: { slug: 'test', name: 'Test', engine: 'cheerio' },
      source: { url: 'https://example.com/manga/test/', language: null },
      metadata: {
        title: 'Test',
        author: null,
        description: null,
        status: null,
        genres: [],
      },
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

    useCase = new GetSourceUseCase(mockRepo as any)
    const result = await useCase.execute('src-test-12345678')
    expect(result).not.toHaveProperty('cache')
  })

  it('deve lançar erro quando source não existe', async () => {
    useCase = new GetSourceUseCase(mockRepo as any)
    await expect(useCase.execute('src-nonexistent')).rejects.toThrow(
      'Source não encontrada',
    )
  })

  it('deve retornar isRead: true para capítulos lidos quando userId informado', async () => {
    const now = new Date().toISOString()
    const readingRepo = createReadingRepo(['chap_0001'])

    await mockRepo.save('src-test-12345678', {
      sourceId: 'src-test-12345678',
      status: 'ready',
      provider: { slug: 'test', name: 'Test', engine: 'cheerio' },
      source: { url: 'https://example.com/manga/test/', language: null },
      metadata: {
        title: 'Test',
        author: null,
        description: null,
        status: null,
        genres: [],
      },
      chapters: [
        { id: 'chap_0001', number: '1', title: 'Ch1', url: 'https://e.com/c1/', pages: null, volume: null },
        { id: 'chap_0002', number: '2', title: 'Ch2', url: 'https://e.com/c2/', pages: null, volume: null },
      ],
      covers: [],
      statistics: { chapters: 2, covers: 0 },
      cache: { createdAt: now, updatedAt: now, lastAccessAt: now, cacheTtlHours: 24, retentionDays: 30 },
    })

    useCase = new GetSourceUseCase(mockRepo as any, readingRepo)
    const result = await useCase.execute('src-test-12345678', 'user-1')

    expect(result.chapters[0].isRead).toBe(true)
    expect(result.chapters[1].isRead).toBe(false)
  })

  it('deve retornar isRead: false para todos os capítulos quando usuário anônimo', async () => {
    const now = new Date().toISOString()

    await mockRepo.save('src-test-12345678', {
      sourceId: 'src-test-12345678',
      status: 'ready',
      provider: { slug: 'test', name: 'Test', engine: 'cheerio' },
      source: { url: 'https://example.com/manga/test/', language: null },
      metadata: { title: 'Test', author: null, description: null, status: null, genres: [] },
      chapters: [
        { id: 'chap_0001', number: '1', title: 'Ch1', url: 'https://e.com/c1/', pages: null, volume: null },
      ],
      covers: [],
      statistics: { chapters: 1, covers: 0 },
      cache: { createdAt: now, updatedAt: now, lastAccessAt: now, cacheTtlHours: 24, retentionDays: 30 },
    })

    useCase = new GetSourceUseCase(mockRepo as any)
    const result = await useCase.execute('src-test-12345678')

    expect(result.chapters[0].isRead).toBe(false)
  })
})
