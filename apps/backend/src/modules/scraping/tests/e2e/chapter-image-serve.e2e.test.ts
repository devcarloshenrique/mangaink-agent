import { vi, describe, it, expect, beforeEach } from 'vitest'

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
    getPlaceholderIndices: async () => [],
    updatePlaceholderIndices: async () => {},
  }
})

const mockFsReadDir = vi.hoisted(() => vi.fn())
const mockFsReadFile = vi.hoisted(() => vi.fn())

const mockProvider = vi.hoisted(() => ({
  downloadImage: vi.fn(),
  getChapterImages: vi.fn(),
  inspect: vi.fn(),
}))

vi.mock('../../../../shared/database/repositories', async () => {
  const actual = await vi.importActual<
    typeof import('../../../../shared/database/repositories')
  >('../../../../shared/database/repositories')
  return {
    ...actual,
    getSourceRepository: vi.fn(() => mockRepo),
  }
})

vi.mock('../../utils/resolve-provider', () => ({
  resolveProvider: vi.fn(async () => mockProvider),
}))

vi.mock('../../services/chapter-image.service', () => ({
  ChapterImageService: vi.fn().mockImplementation(
    (_provider: any, _sourceId: string, _chapterId: string, _storagePath: string) => ({
      isCached: vi.fn(),
      readManifest: vi.fn(),
      getCacheDir: vi.fn(),
      countCachedImages: vi.fn(),
    }),
  ),
}))

vi.mock('node:fs/promises', () => ({
  readdir: vi.fn(),
  readFile: vi.fn(),
}))

vi.mock('ioredis', () => ({
  default: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    get: vi.fn(),
    set: vi.fn(),
    hgetall: vi.fn(),
    hmset: vi.fn(),
    expire: vi.fn(),
    quit: vi.fn(),
    publish: vi.fn(),
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    rpush: vi.fn(),
    lrange: vi.fn(),
    incr: vi.fn(),
  })),
}))

vi.mock('bullmq', () => ({
  Worker: vi.fn().mockImplementation(() => ({ on: vi.fn(), close: vi.fn() })),
  Queue: vi.fn(),
}))

import { createServer } from '../../../../shared/server'
import { ChapterImageService } from '../../services/chapter-image.service'
import type { FastifyInstance } from 'fastify'
import { readdir, readFile } from 'node:fs/promises'

const baseSourceData = {
  sourceId: 'src-test-e2e-img-12345678',
  status: 'ready' as const,
  provider: { slug: 'mangalivre', name: 'Manga Livre', engine: 'cheerio' as const },
  source: { url: 'https://mangalivre.to/manga/test/', language: null },
  metadata: {
    title: 'Test Manga',
    author: 'Test Author',
    description: 'A test manga',
    status: 'ongoing',
    genres: ['Action', 'Adventure'],
  },
  chapters: [
    {
      id: 'chap_0001',
      number: '1',
      title: 'Chapter 1',
      url: 'https://mangalivre.to/chap-1/',
      pages: 10,
      volume: null,
      isDownloaded: false,
    },
    {
      id: 'chap_no_url',
      number: '2',
      title: 'Chapter 2',
      url: '',
      pages: 5,
      volume: null,
      isDownloaded: false,
    },
  ],
  covers: [
    {
      id: 'cover_001',
      type: 'original' as const,
      label: 'Original',
      imageUrl: 'https://mangalivre.to/cover.jpg',
    },
  ],
  statistics: { chapters: 2, covers: 1 },
  cache: {
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastAccessAt: new Date().toISOString(),
    cacheTtlHours: 24,
    retentionDays: 30,
  },
}

const validJpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0])

function imageUrl(index: string) {
  return `/api/sources/src-test-e2e-img-12345678/chapters/chap_0001/images/${index}`
}

describe('Chapter Image Serve E2E', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    mockRepo.reset()
    vi.mocked(mockProvider.downloadImage).mockReset()
    vi.mocked(mockProvider.getChapterImages).mockReset()
    vi.mocked(mockProvider.inspect).mockReset()
    vi.mocked(readdir).mockReset()
    vi.mocked(readFile).mockReset()

    await mockRepo.save(baseSourceData.sourceId, { ...baseSourceData })

    app = await createServer()
  })

  it('cache hit retorna 200 com imagem e Cache-Control immutable', async () => {
    vi.mocked(ChapterImageService).mockImplementationOnce(
      (_provider: any, _sourceId: string, _chapterId: string, _storagePath: string) => ({
        isCached: vi.fn().mockResolvedValue(true),
        readManifest: vi.fn().mockResolvedValue({ totalImages: 10, urls: [] }),
        getCacheDir: vi.fn(() => '/tmp/mock-cache'),
        countCachedImages: vi.fn().mockResolvedValue(10),
      }),
    )

    vi.mocked(readdir).mockResolvedValueOnce([
      '0001.jpg',
      '0002.jpg',
      'manifest.json',
    ] as any)
    vi.mocked(readFile).mockResolvedValueOnce(validJpegBuffer)

    const response = await app.inject({
      method: 'GET',
      url: imageUrl('1'),
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toBe('image/jpeg')
    expect(response.headers['cache-control']).toBe('public, max-age=86400, immutable')
  })

  it('cache miss + manifest proxy retorna 200', async () => {
    vi.mocked(ChapterImageService).mockImplementationOnce(
      (_provider: any, _sourceId: string, _chapterId: string, _storagePath: string) => ({
        isCached: vi.fn().mockResolvedValue(false),
        readManifest: vi.fn().mockResolvedValue({
          totalImages: 10,
          urls: Array.from({ length: 10 }, (_, i) => `https://img.example.com/${i + 1}.jpg`),
        }),
        getCacheDir: vi.fn(() => '/tmp/mock-cache'),
        countCachedImages: vi.fn().mockResolvedValue(5),
      }),
    )

    vi.mocked(readdir).mockRejectedValueOnce(new Error('ENOENT'))
    vi.mocked(mockProvider.downloadImage).mockResolvedValueOnce({
      buffer: validJpegBuffer,
      contentType: 'image/jpeg',
    })

    const response = await app.inject({
      method: 'GET',
      url: imageUrl('1'),
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toBe('image/jpeg')
    expect(response.headers['cache-control']).toBe('no-cache')
  })

  it('cache miss + manifest + proxy falha retorna 425 com readyPages/totalPages', async () => {
    vi.mocked(ChapterImageService).mockImplementationOnce(
      (_provider: any, _sourceId: string, _chapterId: string, _storagePath: string) => ({
        isCached: vi.fn().mockResolvedValue(false),
        readManifest: vi.fn().mockResolvedValue({
          totalImages: 10,
          urls: Array.from({ length: 10 }, (_, i) => `https://img.example.com/${i + 1}.jpg`),
        }),
        getCacheDir: vi.fn(() => '/tmp/mock-cache'),
        countCachedImages: vi.fn().mockResolvedValue(0),
      }),
    )

    vi.mocked(readdir).mockRejectedValueOnce(new Error('ENOENT'))
    vi.mocked(mockProvider.downloadImage).mockRejectedValueOnce(new Error('Timeout'))

    const response = await app.inject({
      method: 'GET',
      url: imageUrl('1'),
    })

    expect(response.statusCode).toBe(425)
    const body = response.json()
    expect(body.readyPages).toBe(0)
    expect(body.totalPages).toBe(10)
  })

  it('cache miss + sem manifest + chapter.url retorna 200 (fallback)', async () => {
    vi.mocked(ChapterImageService).mockImplementationOnce(
      (_provider: any, _sourceId: string, _chapterId: string, _storagePath: string) => ({
        isCached: vi.fn().mockResolvedValue(false),
        readManifest: vi.fn().mockResolvedValue(null),
        getCacheDir: vi.fn(() => '/tmp/mock-cache'),
        countCachedImages: vi.fn().mockResolvedValue(0),
      }),
    )

    vi.mocked(readdir).mockRejectedValueOnce(new Error('ENOENT'))

    const imageUrls = Array.from(
      { length: 10 },
      (_, i) => `https://img.example.com/${i + 1}.jpg`,
    )
    vi.mocked(mockProvider.getChapterImages).mockResolvedValueOnce(imageUrls)
    vi.mocked(mockProvider.downloadImage).mockResolvedValueOnce({
      buffer: validJpegBuffer,
      contentType: 'image/jpeg',
    })

    const response = await app.inject({
      method: 'GET',
      url: imageUrl('1'),
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toBe('image/jpeg')
    expect(response.headers['cache-control']).toBe('no-cache')
    expect(mockProvider.getChapterImages).toHaveBeenCalledWith(
      'https://mangalivre.to/chap-1/',
    )
  })

  it('cache miss + sem manifest + sem chapter.url retorna 404 PAGE_NOT_FOUND', async () => {
    vi.mocked(ChapterImageService).mockImplementationOnce(
      (_provider: any, _sourceId: string, _chapterId: string, _storagePath: string) => ({
        isCached: vi.fn().mockResolvedValue(false),
        readManifest: vi.fn().mockResolvedValue(null),
        getCacheDir: vi.fn(() => '/tmp/mock-cache'),
        countCachedImages: vi.fn().mockResolvedValue(0),
      }),
    )

    vi.mocked(readdir).mockRejectedValueOnce(new Error('ENOENT'))

    const response = await app.inject({
      method: 'GET',
      url: '/api/sources/src-test-e2e-img-12345678/chapters/chap_no_url/images/1',
    })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toHaveProperty('error')
  })

  it('index < 1 retorna 400 INVALID_PAGE_INDEX', async () => {
    vi.mocked(ChapterImageService).mockImplementationOnce(
      (_provider: any, _sourceId: string, _chapterId: string, _storagePath: string) => ({
        isCached: vi.fn().mockResolvedValue(false),
        readManifest: vi.fn().mockResolvedValue({ totalImages: 10, urls: [] }),
        getCacheDir: vi.fn(() => '/tmp/mock-cache'),
        countCachedImages: vi.fn().mockResolvedValue(0),
      }),
    )

    vi.mocked(readdir).mockResolvedValueOnce([] as any)

    const response = await app.inject({
      method: 'GET',
      url: imageUrl('0'),
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toHaveProperty('error')
  })

  it('index > totalImages (via manifest) retorna 400 INVALID_PAGE_INDEX', async () => {
    vi.mocked(ChapterImageService).mockImplementationOnce(
      (_provider: any, _sourceId: string, _chapterId: string, _storagePath: string) => ({
        isCached: vi.fn().mockResolvedValue(false),
        readManifest: vi.fn().mockResolvedValue({ totalImages: 10, urls: [] }),
        getCacheDir: vi.fn(() => '/tmp/mock-cache'),
        countCachedImages: vi.fn().mockResolvedValue(0),
      }),
    )

    vi.mocked(readdir).mockResolvedValueOnce([] as any)

    const response = await app.inject({
      method: 'GET',
      url: imageUrl('99'),
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toHaveProperty('error')
  })

  it('endpoint público — sem token retorna 200 em cache hit', async () => {
    vi.mocked(ChapterImageService).mockImplementationOnce(
      (_provider: any, _sourceId: string, _chapterId: string, _storagePath: string) => ({
        isCached: vi.fn().mockResolvedValue(true),
        readManifest: vi.fn().mockResolvedValue({ totalImages: 10, urls: [] }),
        getCacheDir: vi.fn(() => '/tmp/mock-cache'),
        countCachedImages: vi.fn().mockResolvedValue(10),
      }),
    )

    vi.mocked(readdir).mockResolvedValueOnce([
      '0001.jpg',
      '0002.jpg',
      'manifest.json',
    ] as any)
    vi.mocked(readFile).mockResolvedValueOnce(validJpegBuffer)

    const response = await app.inject({
      method: 'GET',
      url: imageUrl('1'),
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers['cache-control']).toBe('public, max-age=86400, immutable')
  })

  it('source inexistente retorna 500 (SourceNotFoundError não tratado pelo handler)', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/sources/src-nonexistent/chapters/chap_0001/images/1',
    })

    expect(response.statusCode).toBe(500)
    expect(response.json()).toHaveProperty('error')
  })

  it('chapter inexistente retorna 404', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/sources/src-test-e2e-img-12345678/chapters/chap_nonexistent/images/1',
    })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toHaveProperty('error')
  })

  it('fallback path: index > imageUrls.length retorna 400', async () => {
    vi.mocked(ChapterImageService).mockImplementationOnce(
      (_provider: any, _sourceId: string, _chapterId: string, _storagePath: string) => ({
        isCached: vi.fn().mockResolvedValue(false),
        readManifest: vi.fn().mockResolvedValue(null),
        getCacheDir: vi.fn(() => '/tmp/mock-cache'),
        countCachedImages: vi.fn().mockResolvedValue(0),
      }),
    )

    vi.mocked(readdir).mockRejectedValueOnce(new Error('ENOENT'))
    vi.mocked(mockProvider.getChapterImages).mockResolvedValueOnce(['https://img.example.com/1.jpg'])

    const response = await app.inject({
      method: 'GET',
      url: imageUrl('5'),
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toHaveProperty('error')
  })
})
