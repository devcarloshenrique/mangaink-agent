import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { JWT_AUDIENCE, JWT_ISSUER } from '../../../auth/services/token.service'
import { randomUUID } from 'node:crypto'

const journalEvents = [
  JSON.stringify({
    type: 'download.chapter.started',
    data: { chapterId: 'chap_0001', totalImages: 20, fromCache: false },
    timestamp: '2026-07-15T10:00:00.000Z',
    id: 1,
  }),
  JSON.stringify({
    type: 'job.finished',
    data: { outputFile: 'Vol_01.epub', outputSize: 5_242_880 },
    timestamp: '2026-07-15T10:01:00.000Z',
    id: 2,
  }),
]

const mockJournal = {
  append: vi.fn(),
  range: vi.fn().mockResolvedValue(journalEvents),
  nextId: vi.fn(),
  expire: vi.fn(),
}

vi.mock('../../../../shared/infra/redis', async () => {
  const actual = await vi.importActual<
    typeof import('../../../../shared/infra/redis')
  >('../../../../shared/infra/redis')
  return {
    ...actual,
    RedisPubSubAdapter: vi.fn(() => ({
      publish: vi.fn(),
      subscribe: vi.fn(),
      subscribeMany: vi.fn(),
      unsubscribe: vi.fn(),
      unsubscribeMany: vi.fn(),
    })),
    RedisJournalAdapter: vi.fn(() => mockJournal),
  }
})

vi.mock('../../services/conversion-queue.service', () => ({
  ConversionQueueService: vi.fn(() => ({
    enqueue: vi.fn(),
    getJob: vi.fn(async () => null),
    close: vi.fn(),
  })),
}))

vi.mock('../../services/conversion-events.service', () => ({
  ConversionEventsService: vi.fn(() => ({
    createEvent: vi.fn(),
    emit: vi.fn(),
    connectJobToSSE: vi.fn(),
    connectConversionToSSE: vi.fn(),
  })),
}))

vi.mock('../../repositories/prisma-conversion.repository', () => ({
  PrismaConversionRepository: vi.fn(() => ({
    create: vi.fn(),
    findById: vi.fn().mockResolvedValue({
      conversionId: 'conv_test_logs_001',
      status: 'completed',
      progress: 100,
      totalJobs: 1,
      completedJobs: 1,
      failedJobs: 0,
      runningJobs: 0,
      pendingJobs: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      jobs: [
        { jobId: 'job_001', index: 0, title: 'Vol 01', status: 'completed', progress: 100 },
      ],
      config: {
        sourceId: 'src-test-000',
        cover: { kind: 'original' as const },
        output: { deviceId: 'K11', format: 'EPUB' },
        metadata: { title: 'Test Manga', author: 'Test Author' },
        books: [{ title: 'Vol 01', chapters: ['chap_0001'] }],
        options: {},
        userId: 'test-user-001',
      },
    }),
    update: vi.fn(),
    syncStatus: vi.fn().mockResolvedValue({
      conversionId: 'conv_test_logs_001',
      status: 'completed',
      progress: 100,
      totalJobs: 1,
      completedJobs: 1,
      failedJobs: 0,
      runningJobs: 0,
      pendingJobs: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      jobs: [
        { jobId: 'job_001', index: 0, title: 'Vol 01', status: 'completed', progress: 100 },
      ],
      config: {
        sourceId: 'src-test-000',
        cover: { kind: 'original' as const },
        output: { deviceId: 'K11', format: 'EPUB' },
        metadata: { title: 'Test Manga', author: 'Test Author' },
        books: [{ title: 'Vol 01', chapters: ['chap_0001'] }],
        options: {},
        userId: 'test-user-001',
      },
    }),
    listJobIds: vi.fn(),
    appendLog: vi.fn(),
    delete: vi.fn(),
    listByUser: vi.fn(),
  })),
  PrismaJobRepository: vi.fn(() => ({
    create: vi.fn(),
    load: vi.fn(),
    save: vi.fn(),
    updateStatus: vi.fn(),
    delete: vi.fn(),
  })),
}))

vi.mock('../../../scraping/repositories/prisma-source.repository', () => ({
  PrismaSourceRepository: vi.fn(() => ({
    exists: vi.fn(),
    load: vi.fn(),
    save: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getPlaceholderIndices: vi.fn().mockResolvedValue([]),
    updatePlaceholderIndices: vi.fn(),
  })),
}))

vi.mock('../../../../shared/database/prisma', () => ({
  prisma: {
    source: {
      findUnique: vi.fn(),
      count: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    chapter: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
    },
    cover: {
      createMany: vi.fn(),
    },
    $transaction: vi.fn((fn: unknown) => (typeof fn === 'function' ? fn({ source: {}, chapter: {}, cover: {} }) : Promise.resolve())),
    $disconnect: vi.fn(),
  },
}))

vi.mock('../../../../shared/redis/bullmq', () => ({
  createQueue: vi.fn(() => ({
    add: vi.fn(async () => ({})),
    getJob: vi.fn(async () => null),
    close: vi.fn(async () => {}),
  })),
}))

vi.mock('../../../../shared/redis/redis', () => ({
  default: { on: vi.fn(), get: vi.fn(), set: vi.fn() },
}))

vi.mock('bullmq', () => ({
  Worker: vi.fn().mockImplementation(() => ({ on: vi.fn(), close: vi.fn() })),
  Queue: vi.fn(),
}))

let app: FastifyInstance

beforeEach(async () => {
  vi.clearAllMocks()
  mockJournal.range.mockResolvedValue(journalEvents)
  const mod = await import('../../../../shared/server')
  app = await mod.createServer()
})

describe('GET /api/conversions/:id/logs — E2E', () => {
  it('deve retornar 401 sem token JWT', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/conversions/conv_test_logs_001/logs',
    })
    expect(res.statusCode).toBe(401)
  })

  it('deve retornar 200 com array de eventos do journal', async () => {
    const token = app.jwt.sign({ sub: 'test-user-001', jti: randomUUID(), iss: JWT_ISSUER, aud: JWT_AUDIENCE })

    const res = await app.inject({
      method: 'GET',
      url: '/api/conversions/conv_test_logs_001/logs',
      headers: { authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body)).toBe(true)
    expect(body).toHaveLength(2)
    expect(body[0].type).toBe('download.chapter.started')
    expect(body[0].data.chapterId).toBe('chap_0001')
    expect(body[1].type).toBe('job.finished')
    expect(body[1].data.outputSize).toBe(5_242_880)
  })

  it('deve retornar 200 com array vazio quando journal não tem eventos', async () => {
    mockJournal.range.mockResolvedValue([])
    const token = app.jwt.sign({ sub: 'test-user-001', jti: randomUUID(), iss: JWT_ISSUER, aud: JWT_AUDIENCE })

    const res = await app.inject({
      method: 'GET',
      url: '/api/conversions/conv_test_logs_001/logs',
      headers: { authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual([])
  })
})
