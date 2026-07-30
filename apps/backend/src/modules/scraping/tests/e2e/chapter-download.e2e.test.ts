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

const mockJobStatusStore = vi.hoisted(() => {
  const store = new Map<string, { jobId: string; status: string }>()
  return {
    reset: () => store.clear(),
    getJobStatus: async (sourceId: string, chapterId: string) => {
      return store.get(`${sourceId}:${chapterId}`) ?? null
    },
    setJobStatus: async (sourceId: string, chapterId: string, jobId: string, status: string) => {
      store.set(`${sourceId}:${chapterId}`, { jobId, status })
    },
  }
})

const mockDownloadQueue = vi.hoisted(() => {
  const jobs: Array<{ id: string; data: any }> = []
  let counter = 0
  return {
    reset: () => { jobs.length = 0; counter = 0 },
    enqueuedJobs: jobs,
    add: async (_name: string, data: any) => {
      const job = { id: `test-download-job-${++counter}`, data }
      jobs.push(job)
      return job
    },
  }
})

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

vi.mock('../../services/chapter-download-queue.service', () => ({
  getChapterDownloadQueue: vi.fn(() => mockDownloadQueue),
}))

vi.mock('../../services/chapter-download-status-store', () => ({
  getJobStatus: vi.fn((sourceId: string, chapterId: string) =>
    mockJobStatusStore.getJobStatus(sourceId, chapterId),
  ),
  setJobStatus: vi.fn(
    (sourceId: string, chapterId: string, jobId: string, status: string) =>
      mockJobStatusStore.setJobStatus(sourceId, chapterId, jobId, status),
  ),
}))

vi.mock('../../services/chapter-download-pubsub.service', () => ({
  ChapterDownloadPubSubService: vi.fn(() => ({
    publish: vi.fn(async () => {}),
    subscribe: vi.fn(async () => {}),
    unsubscribe: vi.fn(async () => {}),
    pubRpush: vi.fn(async () => {}),
    pubLrange: vi.fn(async () => []),
    pubIncr: vi.fn(async () => 1),
    pubExpire: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
  })),
}))

vi.mock('../../services/chapter-download-events.service', () => ({
  ChapterDownloadEventsService: vi.fn(() => ({
    connectToSSE: vi.fn(),
    emit: vi.fn(async () => {}),
    createEvent: vi.fn(() => ({ type: 'test', data: {} })),
  })),
}))

vi.mock('../../services/chapter-image.service', () => ({
  ChapterImageService: vi.fn().mockImplementation((_provider: any, _sourceId: string, _chapterId: string, _storagePath: string) => ({
    isCached: vi.fn(),
    readManifest: vi.fn(),
    getCacheDir: vi.fn(() => '/tmp/mock-cache'),
    countCachedImages: vi.fn(),
  })),
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

import { PrismaUserRepository } from '../../../user/repositories/prisma-user.repository'
import { InMemoryUserRepository } from '../../../auth/tests/helpers/in-memory-user.repository'
import { createServer } from '../../../../shared/server'
import type { FastifyInstance } from 'fastify'

vi.mock('../../../user/repositories/prisma-user.repository', async () => {
  const { InMemoryUserRepository } = await import(
    '../../../auth/tests/helpers/in-memory-user.repository'
  )
  return {
    PrismaUserRepository: vi.fn().mockImplementation(() => new InMemoryUserRepository()),
  }
})

let sharedRepo: InMemoryUserRepository

async function registerUser(
  app: FastifyInstance,
  payload = {
    username: 'testuser',
    email: 'test@example.com',
    password: 'senha1234',
    confirmPassword: 'senha1234',
  },
) {
  return app.inject({
    method: 'POST',
    url: '/auth/register',
    payload,
  })
}

async function loginUser(
  app: FastifyInstance,
  payload = { identifier: 'test@example.com', password: 'senha1234' },
) {
  return app.inject({
    method: 'POST',
    url: '/auth/login',
    payload,
  })
}

async function getToken(app: FastifyInstance): Promise<string> {
  await registerUser(app)
  const login = await loginUser(app)
  return login.json().token
}

const baseSourceData = {
  sourceId: 'src-test-e2e-dl-12345678',
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
      pages: 20,
      volume: null,
      isDownloaded: false,
    },
    {
      id: 'chap_0002',
      number: '2',
      title: 'Chapter 2',
      url: 'https://mangalivre.to/chap-2/',
      pages: 18,
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

describe('Chapter Download E2E', () => {
  let app: FastifyInstance
  let token: string

  beforeEach(async () => {
    mockRepo.reset()
    mockJobStatusStore.reset()
    mockDownloadQueue.reset()
    vi.mocked(mockProvider.downloadImage).mockReset()
    vi.mocked(mockProvider.getChapterImages).mockReset()
    vi.mocked(mockProvider.inspect).mockReset()

    sharedRepo = new InMemoryUserRepository()
    vi.mocked(PrismaUserRepository).mockImplementation(() => sharedRepo)

    app = await createServer()
    token = await getToken(app)

    await mockRepo.save(baseSourceData.sourceId, { ...baseSourceData })
  })

  function authHeader() {
    return { Authorization: `Bearer ${token}` }
  }

  function url(sourceId: string, chapterId: string) {
    return `/api/sources/${sourceId}/chapters/${chapterId}/download`
  }

  // ──────────────────────────────────────────────────────────────
  describe('POST /download', () => {
    it('sem token retorna 401', async () => {
      const response = await app.inject({
        method: 'POST',
        url: url('src-test-e2e-dl-12345678', 'chap_0001'),
      })

      expect(response.statusCode).toBe(401)
    })

    it('com source inexistente retorna 404', async () => {
      const response = await app.inject({
        method: 'POST',
        url: url('src-nonexistent', 'chap_0001'),
        headers: authHeader(),
      })

      expect(response.statusCode).toBe(404)
      expect(response.json()).toHaveProperty('error')
    })

    it('com chapter inexistente retorna 404 CHAPTER_NOT_FOUND', async () => {
      const response = await app.inject({
        method: 'POST',
        url: url('src-test-e2e-dl-12345678', 'chap_nonexistent'),
        headers: authHeader(),
      })

      expect(response.statusCode).toBe(404)
      expect(response.json()).toHaveProperty('error')
    })

    it('com cache completo retorna 200 { status: "ready" }', async () => {
      const { ChapterImageService } = await import('../../services/chapter-image.service')
      vi.mocked(ChapterImageService).mockImplementationOnce(
        (_provider: any, _sourceId: string, _chapterId: string, _storagePath: string) => ({
          isCached: vi.fn().mockResolvedValue(true),
          readManifest: vi.fn().mockResolvedValue(null),
          getCacheDir: vi.fn(() => '/tmp/mock-cache'),
          countCachedImages: vi.fn().mockResolvedValue(0),
        }),
      )

      const response = await app.inject({
        method: 'POST',
        url: url('src-test-e2e-dl-12345678', 'chap_0001'),
        headers: authHeader(),
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.status).toBe('ready')
    })

    it('sem cache retorna 202 { jobId, status: "queued" }', async () => {
      const { ChapterImageService } = await import('../../services/chapter-image.service')
      vi.mocked(ChapterImageService).mockImplementationOnce(
        (_provider: any, _sourceId: string, _chapterId: string, _storagePath: string) => ({
          isCached: vi.fn().mockResolvedValue(false),
          readManifest: vi.fn().mockResolvedValue(null),
          getCacheDir: vi.fn(() => '/tmp/mock-cache'),
          countCachedImages: vi.fn().mockResolvedValue(0),
        }),
      )

      const response = await app.inject({
        method: 'POST',
        url: url('src-test-e2e-dl-12345678', 'chap_0001'),
        headers: authHeader(),
      })

      expect(response.statusCode).toBe(202)
      const body = response.json()
      expect(body).toHaveProperty('jobId')
      expect(body.status).toBe('queued')
      expect(mockDownloadQueue.enqueuedJobs.length).toBeGreaterThan(0)
    })

    it('com job ativo no Redis retorna 202 { jobId, status: "downloading" }', async () => {
      const { ChapterImageService } = await import('../../services/chapter-image.service')
      vi.mocked(ChapterImageService).mockImplementationOnce(
        (_provider: any, _sourceId: string, _chapterId: string, _storagePath: string) => ({
          isCached: vi.fn().mockResolvedValue(false),
          readManifest: vi.fn().mockResolvedValue(null),
          getCacheDir: vi.fn(() => '/tmp/mock-cache'),
          countCachedImages: vi.fn().mockResolvedValue(0),
        }),
      )

      await mockJobStatusStore.setJobStatus(
        'src-test-e2e-dl-12345678',
        'chap_0001',
        'existing-job-id',
        'downloading',
      )

      const response = await app.inject({
        method: 'POST',
        url: url('src-test-e2e-dl-12345678', 'chap_0001'),
        headers: authHeader(),
      })

      expect(response.statusCode).toBe(202)
      const body = response.json()
      expect(body.jobId).toBe('existing-job-id')
      expect(body.status).toBe('downloading')
    })

    it('com job failed retorna 202 com novo jobId', async () => {
      const { ChapterImageService } = await import('../../services/chapter-image.service')
      vi.mocked(ChapterImageService).mockImplementationOnce(
        (_provider: any, _sourceId: string, _chapterId: string, _storagePath: string) => ({
          isCached: vi.fn().mockResolvedValue(false),
          readManifest: vi.fn().mockResolvedValue(null),
          getCacheDir: vi.fn(() => '/tmp/mock-cache'),
          countCachedImages: vi.fn().mockResolvedValue(0),
        }),
      )

      await mockJobStatusStore.setJobStatus(
        'src-test-e2e-dl-12345678',
        'chap_0001',
        'old-failed-job',
        'failed',
      )

      const response = await app.inject({
        method: 'POST',
        url: url('src-test-e2e-dl-12345678', 'chap_0001'),
        headers: authHeader(),
      })

      expect(response.statusCode).toBe(202)
      const body = response.json()
      expect(body.jobId).not.toBe('old-failed-job')
      expect(body.status).toBe('queued')
    })
  })

  // ──────────────────────────────────────────────────────────────
  describe('GET /download', () => {
    it('sem token retorna 401', async () => {
      const response = await app.inject({
        method: 'GET',
        url: url('src-test-e2e-dl-12345678', 'chap_0001'),
      })

      expect(response.statusCode).toBe(401)
    })

    it('com cache pronto retorna 200 { status: "ready", ... }', async () => {
      const { ChapterImageService } = await import('../../services/chapter-image.service')
      vi.mocked(ChapterImageService).mockImplementationOnce(
        (_provider: any, _sourceId: string, _chapterId: string, _storagePath: string) => ({
          isCached: vi.fn().mockResolvedValue(false),
          readManifest: vi.fn().mockResolvedValue({ totalImages: 20, urls: [] }),
          getCacheDir: vi.fn(() => '/tmp/mock-cache'),
          countCachedImages: vi.fn().mockResolvedValue(20),
        }),
      )

      const response = await app.inject({
        method: 'GET',
        url: url('src-test-e2e-dl-12345678', 'chap_0001'),
        headers: authHeader(),
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.status).toBe('ready')
      expect(body.totalImages).toBe(20)
      expect(body.downloadedImages).toBe(20)
    })

    it('com manifest parcial retorna 200 { status: "downloading", ... }', async () => {
      const { ChapterImageService } = await import('../../services/chapter-image.service')
      vi.mocked(ChapterImageService).mockImplementationOnce(
        (_provider: any, _sourceId: string, _chapterId: string, _storagePath: string) => ({
          isCached: vi.fn().mockResolvedValue(false),
          readManifest: vi.fn().mockResolvedValue({ totalImages: 20, urls: [] }),
          getCacheDir: vi.fn(() => '/tmp/mock-cache'),
          countCachedImages: vi.fn().mockResolvedValue(5),
        }),
      )

      const response = await app.inject({
        method: 'GET',
        url: url('src-test-e2e-dl-12345678', 'chap_0001'),
        headers: authHeader(),
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.status).toBe('downloading')
      expect(body.totalImages).toBe(20)
      expect(body.downloadedImages).toBe(5)
    })

    it('sem cache retorna 200 { status: "not_downloaded" }', async () => {
      const { ChapterImageService } = await import('../../services/chapter-image.service')
      vi.mocked(ChapterImageService).mockImplementationOnce(
        (_provider: any, _sourceId: string, _chapterId: string, _storagePath: string) => ({
          isCached: vi.fn().mockResolvedValue(false),
          readManifest: vi.fn().mockResolvedValue(null),
          getCacheDir: vi.fn(() => '/tmp/mock-cache'),
          countCachedImages: vi.fn().mockResolvedValue(0),
        }),
      )

      const response = await app.inject({
        method: 'GET',
        url: url('src-test-e2e-dl-12345678', 'chap_0002'),
        headers: authHeader(),
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.status).toBe('not_downloaded')
      expect(body.totalImages).toBeNull()
      expect(body.downloadedImages).toBe(0)
    })
  })

  // ──────────────────────────────────────────────────────────────
  describe('GET /download/events', () => {
    it('sem token retorna 401', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `${url('src-test-e2e-dl-12345678', 'chap_0001')}/events`,
      })

      expect(response.statusCode).toBe(401)
    })
  })
})
