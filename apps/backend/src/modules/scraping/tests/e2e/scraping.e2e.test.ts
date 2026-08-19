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

const mockStatusStore = vi.hoisted(() => {
  const data = new Map<string, Record<string, string>>()
  return {
    reset: () => data.clear(),
    get: async (key: string) => data.get(key) ?? null,
    set: async (key: string, partial: Record<string, string | number | undefined>, _ttl?: number) => {
      const current = data.get(key) ?? {}
      const merged: Record<string, string> = { ...current }
      for (const [field, value] of Object.entries(partial)) {
        if (value !== undefined) merged[field] = String(value)
      }
      data.set(key, merged)
    },
    clear: async (key: string) => { data.delete(key) },
  }
})

const mockProviderRepo = vi.hoisted(() => {
  const makeSeed = (over: Record<string, unknown> = {}) => ({
    id: 'seed-id',
    slug: '',
    name: '',
    engine: 'cheerio',
    tags: [],
    status: 'active',
    description: null,
    urlExample: null,
    homepage: null,
    searchUrl: null,
    rateLimitMaxConcurrent: 6,
    rateLimitMinTime: 50,
    rateLimitReservoir: null,
    rateLimitReservoirRefreshInterval: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...over,
  })
  const store = new Map<string, any>()
  const reset = () => {
    store.clear()
    store.set(
      'mangalivre',
      makeSeed({
        slug: 'mangalivre',
        name: 'Manga Livre',
        engine: 'cheerio',
        tags: ['mangÃ¡', 'portuguÃªs'],
        status: 'active',
        description:
          'Acervo de mangÃ¡s em portuguÃªs com leitura online. Requer scraping de HTML (cheerio).',
        urlExample: 'https://mangalivre.to/manga/hunter-x-hunter/',
        homepage: 'https://mangalivre.to',
        searchUrl: 'https://mangalivre.to/busca/?search=',
        rateLimitMaxConcurrent: 10,
        rateLimitMinTime: 0,
      }),
    )
    store.set(
      'imperiodabritannia',
      makeSeed({
        slug: 'imperiodabritannia',
        name: 'Imperio da Britannia',
        engine: 'api',
        status: 'beta',
        rateLimitMaxConcurrent: 2,
        rateLimitMinTime: 500,
      }),
    )
    store.set(
      'mangasbrasuka',
      makeSeed({
        slug: 'mangasbrasuka',
        name: 'Mangas Brasukas',
        engine: 'api',
        tags: ['mangÃ¡', 'manhwa', 'manhua', 'portuguÃªs'],
        status: 'active',
        rateLimitMaxConcurrent: 3,
        rateLimitMinTime: 200,
      }),
    )
  }
  reset()
  return {
    reset,
    findAll: async () => Array.from(store.values()),
    findBySlug: async (slug: string) => store.get(slug) ?? null,
    upsertFromSeed: async () => {},
    update: async (slug: string, data: any) => {
      const current = store.get(slug)
      if (!current) return null
      const updated = { ...current, ...data, updatedAt: new Date('2026-02-01T00:00:00Z') }
      store.set(slug, updated)
      return updated
    },
  }
})

vi.mock('../../../../shared/database/repositories', async () => {
  const actual = await vi.importActual<typeof import('../../../../shared/database/repositories')>('../../../../shared/database/repositories')
  return {
    ...actual,
    getSourceRepository: vi.fn(() => mockRepo),
    getProviderRepository: vi.fn(() => mockProviderRepo),
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
    RedisStatusStoreAdapter: vi.fn(() => mockStatusStore),
  }
})

import { createServer } from '../../../../shared/server'
import type { FastifyInstance } from 'fastify'
import { resetProviderResolver } from '../../utils/resolve-provider'
import { JWT_AUDIENCE, JWT_ISSUER } from '../../../auth/services/token.service'
import { randomUUID } from 'node:crypto'

function signTestToken(app: FastifyInstance, sub = 'test-user-001', role: 'USER' | 'ADMIN' = 'ADMIN') {
  return app.jwt.sign({ sub, role, jti: randomUUID(), iss: JWT_ISSUER, aud: JWT_AUDIENCE })
}

describe('Scraping E2E', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    mockRepo.reset()
    mockLockService.reset()
    mockQueueService.reset()
    mockPubSub.reset()
    mockJournal.reset()
    mockStatusStore.reset()
    mockProviderRepo.reset()
    resetProviderResolver()
    app = await createServer()
  })

  describe('POST /api/conversions/source/inspect', () => {
    it('deve retornar 401 sem token JWT (auth obrigatÃ³ria)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/conversions/source/inspect',
        payload: { url: 'https://mangalivre.to/manga/hunter-x-hunter/' },
      })

      expect(response.statusCode).toBe(401)
    })

    it('deve retornar 202 com sourceId e status "processing" para URL vÃ¡lida', async () => {
      const token = signTestToken(app)
      const response = await app.inject({
        method: 'POST',
        url: '/api/conversions/source/inspect',
        headers: { authorization: `Bearer ${token}` },
        payload: { url: 'https://mangalivre.to/manga/hunter-x-hunter/' },
      })

      expect(response.statusCode).toBe(202)
      const body = response.json()
      expect(body).toHaveProperty('sourceId')
      expect(body.status).toBe('processing')
    })

    it('deve retornar 400 para URL invÃ¡lida', async () => {
      const token = signTestToken(app)
      const response = await app.inject({
        method: 'POST',
        url: '/api/conversions/source/inspect',
        headers: { authorization: `Bearer ${token}` },
        payload: { url: 'not-a-url' },
      })

      expect(response.statusCode).toBe(400)
      expect(response.json()).toHaveProperty('error')
    })

    it('deve retornar 422 para URL de domÃ­nio nÃ£o suportado', async () => {
      const token = signTestToken(app)
      const response = await app.inject({
        method: 'POST',
        url: '/api/conversions/source/inspect',
        headers: { authorization: `Bearer ${token}` },
        payload: { url: 'https://example.com/manga/test/' },
      })

      expect(response.statusCode).toBe(422)
      expect(response.json()).toHaveProperty('error')
    })

    it('deve retornar 400 quando body nÃ£o tem URL', async () => {
      const token = signTestToken(app)
      const response = await app.inject({
        method: 'POST',
        url: '/api/conversions/source/inspect',
        headers: { authorization: `Bearer ${token}` },
        payload: {},
      })

      expect(response.statusCode).toBe(400)
    })

    it('deve aceitar parÃ¢metro refresh=true', async () => {
      const token = signTestToken(app)
      const response = await app.inject({
        method: 'POST',
        url: '/api/conversions/source/inspect?refresh=true',
        headers: { authorization: `Bearer ${token}` },
        payload: { url: 'https://mangalivre.to/manga/hunter-x-hunter/' },
      })

      expect([200, 202]).toContain(response.statusCode)
    })

    it('deve retornar 400 para URL acima do limite de 2048 caracteres', async () => {
      const token = signTestToken(app)
      const url = `https://mangalivre.to/manga/${'a'.repeat(2100)}/`
      const response = await app.inject({
        method: 'POST',
        url: '/api/conversions/source/inspect',
        headers: { authorization: `Bearer ${token}` },
        payload: { url },
      })

      expect(response.statusCode).toBe(400)
    })

    it('deve retornar 400 para URL whitespace-only', async () => {
      const token = signTestToken(app)
      const response = await app.inject({
        method: 'POST',
        url: '/api/conversions/source/inspect',
        headers: { authorization: `Bearer ${token}` },
        payload: { url: '   ' },
      })

      expect(response.statusCode).toBe(400)
    })

    it('deve retornar 429 apÃ³s exceder o rate limit (10/min por usuÃ¡rio)', async () => {
      const token = signTestToken(app)
      for (let i = 0; i < 10; i += 1) {
        const response = await app.inject({
          method: 'POST',
          url: '/api/conversions/source/inspect',
          headers: { authorization: `Bearer ${token}` },
          payload: { url: 'https://mangalivre.to/manga/hunter-x-hunter/' },
        })
        expect([200, 202]).toContain(response.statusCode)
      }

      const limited = await app.inject({
        method: 'POST',
        url: '/api/conversions/source/inspect',
        headers: { authorization: `Bearer ${token}` },
        payload: { url: 'https://mangalivre.to/manga/hunter-x-hunter/' },
      })
      expect(limited.statusCode).toBe(429)
    })
  })

  describe('GET /api/conversions/source/inspect/:sourceId/events (SSE)', () => {
    it('deve retornar 401 sem token JWT', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/conversions/source/inspect/src-any-12345678/events',
      })

      expect(response.statusCode).toBe(401)
    })

    it('deve retornar 403 para SSE de job alheio (dono â‰  usuÃ¡rio)', async () => {
      // UsuÃ¡rio A dispara a inspeÃ§Ã£o â†’ registra ownership do sourceId
      const tokenA = signTestToken(app, 'user-owner-aaa')
      const post = await app.inject({
        method: 'POST',
        url: '/api/conversions/source/inspect',
        headers: { authorization: `Bearer ${tokenA}` },
        payload: { url: 'https://mangalivre.to/manga/hunter-x-hunter/' },
      })
      expect(post.statusCode).toBe(202)
      const sourceId = post.json().sourceId

      // UsuÃ¡rio B tenta observar o SSE do job de A
      const tokenB = signTestToken(app, 'user-intruder-bbb')
      const response = await app.inject({
        method: 'GET',
        url: `/api/conversions/source/inspect/${sourceId}/events`,
        headers: { authorization: `Bearer ${tokenB}` },
      })

      expect(response.statusCode).toBe(403)
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

    it('deve incluir o shape completo e nÃ£o expor allowedDomains', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/conversions/source/providers',
      })

      const body = response.json()
      for (const provider of body.providers) {
        expect(provider).toHaveProperty('slug')
        expect(provider).toHaveProperty('name')
        expect(provider).toHaveProperty('engine')
        expect(provider).toHaveProperty('tags')
        expect(provider).toHaveProperty('status')
        expect(provider).toHaveProperty('description')
        expect(provider).toHaveProperty('urlExample')
        expect(provider).toHaveProperty('homepage')
        expect(provider).toHaveProperty('searchUrl')
        expect(provider).toHaveProperty('rateLimit')
        expect(provider.rateLimit).toHaveProperty('maxConcurrent')
        expect(provider.rateLimit).toHaveProperty('minTime')
        expect(provider.rateLimit).toHaveProperty('reservoir')
        expect(provider.rateLimit).toHaveProperty('reservoirRefreshInterval')
        expect(provider).not.toHaveProperty('allowedDomains')
      }

      const mangalivre = body.providers.find((p: { slug: string }) => p.slug === 'mangalivre')
      expect(mangalivre.description).toBe(
        'Acervo de mangÃ¡s em portuguÃªs com leitura online. Requer scraping de HTML (cheerio).',
      )
      expect(mangalivre.urlExample).toBe('https://mangalivre.to/manga/hunter-x-hunter/')
      expect(mangalivre.homepage).toBe('https://mangalivre.to')
      expect(mangalivre.searchUrl).toBe('https://mangalivre.to/busca/?search=')
      expect(mangalivre.rateLimit).toEqual({ maxConcurrent: 10, minTime: 0, reservoir: null, reservoirRefreshInterval: null })
    })
  })

  describe('PATCH /api/conversions/source/providers/:slug', () => {
    it('deve retornar 401 sem token JWT', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/conversions/source/providers/mangalivre',
        payload: { status: 'slow' },
      })

      expect(response.statusCode).toBe(401)
    })

    it('deve retornar 403 para usuário autenticado sem role ADMIN', async () => {
      const userToken = signTestToken(app, 'regular-user', 'USER')
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/conversions/source/providers/mangalivre',
        headers: { authorization: `Bearer ${userToken}` },
        payload: { status: 'slow' },
      })

      expect(response.statusCode).toBe(403)
      expect(response.json()).toEqual({ error: 'Acesso negado' })
    })

    it('deve retornar 404 para slug inexistente', async () => {
      const token = signTestToken(app)
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/conversions/source/providers/slug-inexistente',
        headers: { authorization: `Bearer ${token}` },
        payload: { status: 'slow' },
      })

      expect(response.statusCode).toBe(404)
      expect(response.json()).toHaveProperty('error')
    })

    it('deve atualizar o provider e refletir no GET', async () => {
      const token = signTestToken(app)
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/conversions/source/providers/mangalivre',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          status: 'slow',
          description: 'Provider em teste',
          rateLimit: { maxConcurrent: 1, minTime: 500 },
        },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.slug).toBe('mangalivre')
      expect(body.status).toBe('slow')
      expect(body.description).toBe('Provider em teste')
      expect(body.rateLimit.maxConcurrent).toBe(1)
      expect(body.rateLimit.minTime).toBe(500)

      const getRes = await app.inject({ method: 'GET', url: '/api/conversions/source/providers' })
      const list = getRes.json().providers
      const mangalivre = list.find((p: { slug: string }) => p.slug === 'mangalivre')
      expect(mangalivre.status).toBe('slow')
      expect(mangalivre.rateLimit.maxConcurrent).toBe(1)
      expect(mangalivre).not.toHaveProperty('allowedDomains')
    })

    it('deve retornar 400 para body invÃ¡lido', async () => {
      const token = signTestToken(app)
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/conversions/source/providers/mangalivre',
        headers: { authorization: `Bearer ${token}` },
        payload: { status: 'status-invalido' },
      })

      expect(response.statusCode).toBe(400)
    })
  })
})