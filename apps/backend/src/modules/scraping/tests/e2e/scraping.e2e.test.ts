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

const mockLockService = vi.hoisted(() => {
  const locks = new Map<string, boolean>()
  return {
    reset: () => locks.clear(),
    acquire: async (sourceId: string) => {
      if (locks.get(sourceId)) return false
      locks.set(sourceId, true)
      return true
    },
    release: async (sourceId: string) => { locks.delete(sourceId) },
    isLocked: async (sourceId: string) => locks.has(sourceId),
  }
})

const mockQueueService = vi.hoisted(() => {
  const jobs: any[] = []
  return {
    reset: () => { jobs.length = 0 },
    enqueuedJobs: jobs,
    enqueue: async (job: any) => { jobs.push(job) },
    getQueueName: () => 'source-inspect-test',
  }
})

const mockPubSub = vi.hoisted(() => {
  const msgs: any[] = []
  return {
    reset: () => { msgs.length = 0 },
    publishedMessages: msgs,
    publish: async (sourceId: string, message: any) => { msgs.push({ sourceId, message }) },
    subscribe: (_sourceId: string, _onMessage: any) => ({ unsubscribe: async () => {} }),
  }
})

const mockJournal = vi.hoisted(() => {
  return {
    reset: () => {},
    append: async () => {},
    range: async () => [] as string[],
    nextId: async () => 1,
    expire: async () => {},
  }
})

vi.mock('../../../../shared/database/repositories', async () => {
  const actual = await vi.importActual<typeof import('../../../../shared/database/repositories')>('../../../../shared/database/repositories')
  return {
    ...actual,
    getSourceRepository: vi.fn(() => mockRepo),
  }
})

vi.mock('../../services/redis-lock.service', () => ({
  RedisLockService: vi.fn(() => mockLockService),
}))

vi.mock('../../services/inspect-queue.service', () => ({
  InspectQueueService: vi.fn(() => mockQueueService),
}))

vi.mock('../../../../shared/infra/redis', async () => {
  const actual = await vi.importActual<
    typeof import('../../../../shared/infra/redis')
  >('../../../../shared/infra/redis')
  return {
    ...actual,
    RedisPubSubAdapter: vi.fn(() => mockPubSub),
    RedisJournalAdapter: vi.fn(() => mockJournal),
  }
})

import { createServer } from '../../../../shared/server'
import type { FastifyInstance } from 'fastify'

describe('Scraping E2E', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    mockRepo.reset()
    mockLockService.reset()
    mockQueueService.reset()
    mockPubSub.reset()
    app = await createServer()
  })

  describe('POST /api/conversions/source/inspect', () => {
    it('deve retornar 202 com sourceId e status "processing" para URL válida', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/conversions/source/inspect',
        payload: { url: 'https://mangalivre.to/manga/hunter-x-hunter/' },
      })

      expect(response.statusCode).toBe(202)
      const body = response.json()
      expect(body).toHaveProperty('sourceId')
      expect(body.status).toBe('processing')
    })

    it('deve retornar 400 para URL inválida', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/conversions/source/inspect',
        payload: { url: 'not-a-url' },
      })

      expect(response.statusCode).toBe(400)
      expect(response.json()).toHaveProperty('error')
    })

    it('deve retornar 422 para URL de domínio não suportado', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/conversions/source/inspect',
        payload: { url: 'https://example.com/manga/test/' },
      })

      expect(response.statusCode).toBe(422)
      expect(response.json()).toHaveProperty('error')
    })

    it('deve retornar 400 quando body não tem URL', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/conversions/source/inspect',
        payload: {},
      })

      expect(response.statusCode).toBe(400)
    })

    it('deve aceitar parâmetro refresh=true', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/conversions/source/inspect?refresh=true',
        payload: { url: 'https://mangalivre.to/manga/hunter-x-hunter/' },
      })

      expect([200, 202]).toContain(response.statusCode)
    })
  })

  describe('GET /api/conversions/source/inspect/:sourceId', () => {
    it('deve retornar 404 para sourceId inexistente', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/conversions/source/inspect/src-nonexistent-12345678',
      })

      expect(response.statusCode).toBe(404)
      expect(response.json()).toHaveProperty('error')
    })

    it('deve retornar dados completos para sourceId existente', async () => {
      const now = new Date().toISOString()
      await mockRepo.save('src-test-e2e-12345678', {
        sourceId: 'src-test-e2e-12345678',
        status: 'ready',
        provider: { slug: 'mangalivre', name: 'Manga Livre', engine: 'cheerio' },
        source: { url: 'https://mangalivre.to/manga/test/', language: null },
        metadata: {
          title: 'Test Manga',
          author: 'Test Author',
          description: 'A test manga',
          status: 'ongoing',
          genres: ['Action', 'Adventure'],
        },
        chapters: [
          { id: 'chap_0001', number: '1', title: 'Chapter 1', url: 'https://mangalivre.to/chap-1/', pages: null, volume: null, isDownloaded: false },
        ],
        covers: [
          { id: 'cover_001', type: 'original', label: 'Original', imageUrl: 'https://mangalivre.to/cover.jpg' },
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

      const response = await app.inject({
        method: 'GET',
        url: '/api/conversions/source/inspect/src-test-e2e-12345678',
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.sourceId).toBe('src-test-e2e-12345678')
      expect(body.metadata.title).toBe('Test Manga')
      expect(body).not.toHaveProperty('cache')
    })
  })

  describe('GET /api/conversions/source/providers', () => {
    it('deve retornar lista de providers', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/conversions/source/providers',
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body).toHaveProperty('providers')
      expect(Array.isArray(body.providers)).toBe(true)
      expect(body.providers.length).toBeGreaterThan(0)
    })

    it('deve incluir slug e name em cada provider', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/conversions/source/providers',
      })

      const body = response.json()
      for (const provider of body.providers) {
        expect(provider).toHaveProperty('slug')
        expect(provider).toHaveProperty('name')
        expect(provider).toHaveProperty('engine')
        expect(provider).toHaveProperty('allowedDomains')
      }
    })
  })
})