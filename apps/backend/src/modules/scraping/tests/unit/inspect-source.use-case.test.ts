import { describe, expect, it, beforeEach, vi } from 'vitest'

const sharedInstances = vi.hoisted(() => {
  class InMemRepo {
    private store = new Map<string, any>()
    reset() { this.store.clear() }
    async exists(id: string) { return this.store.has(id) }
    async load(id: string) { return this.store.get(id) ?? null }
    async save(id: string, data: any) { this.store.set(id, data) }
    async update(id: string, patch: any) {
      const current = this.store.get(id)
      if (current) this.store.set(id, { ...current, cache: { ...current.cache, ...patch } })
    }
    async delete(id: string) { this.store.delete(id) }
  }

  class MockLock {
    private locks = new Map<string, boolean>()
    reset() { this.locks.clear() }
    async acquire(sourceId: string) {
      if (this.locks.get(sourceId)) return false
      this.locks.set(sourceId, true)
      return true
    }
    async release(sourceId: string) { this.locks.delete(sourceId) }
    async isLocked(sourceId: string) { return this.locks.has(sourceId) }
  }

  class MockQueue {
    enqueuedJobs: any[] = []
    reset() { this.enqueuedJobs = [] }
    async enqueue(job: any) { this.enqueuedJobs.push(job) }
    getQueueName() { return 'source-inspect-test' }
  }

  class MockProv {
    slug = 'test-provider'
    name = 'Test Provider'
    engine = 'cheerio' as const
    urlPattern = /test\.example\.com\/manga\//
    allowedDomains = ['test.example.com']
    supports(url: string) {
      try { return this.allowedDomains.includes(new URL(url).hostname) }
      catch { return false }
    }
    getInfo() { return { slug: this.slug, name: this.name, engine: this.engine } }
    async inspect(_url: string) {
      return {
        sourceId: 'src-test-source-12345678',
        status: 'ready' as const,
        provider: { slug: this.slug, name: this.name, engine: 'cheerio' as const },
        source: { url: _url, language: null },
        metadata: { title: 'Test Manga', author: 'Test Author', description: 'A test manga', status: 'ongoing', genres: ['Action'] },
        chapters: [], covers: [], statistics: { chapters: 0, covers: 0 },
      }
    }
    reset() {}
  }

  class MockResolver {
    private providers: any[] = []
    private resolveError: Error | null = null
    private notFoundErrorCtor: new (url: string) => Error = class extends Error {
      constructor(url: string) { super(`Nenhum provider suporta a URL: ${url}`) }
    }
    setProviders(p: any[]) { this.providers = p }
    setResolveError(e: Error | null) { this.resolveError = e }
    resolve(url: string) {
      if (this.resolveError) throw this.resolveError
      const p = this.providers.find((p: any) => p.supports(url))
      if (!p) throw new this.notFoundErrorCtor(url)
      return p
    }
    listAll() { return this.providers }
    reset() { this.providers = []; this.resolveError = null }
  }

  const provider = new MockProv()
  const resolver = new MockResolver()
  resolver.setProviders([provider])

  return {
    repo: new InMemRepo(),
    lockService: new MockLock(),
    queueService: new MockQueue(),
    provider,
    resolver,
  }
})

vi.mock('../../providers/provider-resolver', () => ({
  ProviderResolver: vi.fn(() => sharedInstances.resolver),
}))

vi.mock('../../repositories/filesystem-source.repository', () => ({
  FilesystemSourceRepository: vi.fn(() => sharedInstances.repo),
}))

vi.mock('../../services/redis-lock.service', () => ({
  RedisLockService: vi.fn(() => sharedInstances.lockService),
}))

vi.mock('../../services/inspect-queue.service', () => ({
  InspectQueueService: vi.fn(() => sharedInstances.queueService),
}))

import { InspectSourceUseCase } from '../../use-cases/inspect-source.use-case'

describe('InspectSourceUseCase', () => {
  let useCase: InspectSourceUseCase

  beforeEach(() => {
    sharedInstances.repo.reset()
    sharedInstances.lockService.reset()
    sharedInstances.queueService.reset()
    sharedInstances.provider.reset()
    sharedInstances.resolver.reset()
    sharedInstances.resolver.setProviders([sharedInstances.provider])
    useCase = new InspectSourceUseCase()
  })

  describe('execute', () => {
    it('deve retornar status "ready" quando cache é válido', async () => {
      const url = 'https://test.example.com/manga/test-series/'

      // First call: cache miss, returns processing and generates sourceId
      const firstResult = await useCase.execute({ url, refresh: false })
      expect(firstResult.status).toBe('processing')

      // Pre-populate cache with the correct sourceId
      const now = new Date().toISOString()
      await sharedInstances.repo.save(firstResult.sourceId, {
        sourceId: firstResult.sourceId,
        status: 'ready',
        provider: { slug: 'test-provider', name: 'Test Provider', engine: 'cheerio' },
        source: { url, language: null },
        metadata: { title: 'Test Series', author: null, description: null, status: null, genres: [] },
        chapters: [],
        covers: [],
        statistics: { chapters: 0, covers: 0 },
        cache: { createdAt: now, updatedAt: now, lastAccessAt: now, cacheTtlHours: 24, retentionDays: 30 },
      })

      // Second call: cache hit!
      const result = await useCase.execute({ url, refresh: false })
      expect(result.status).toBe('ready')
      expect(result.sourceId).toBe(firstResult.sourceId)
    })

    it('deve retornar status "processing" quando cache não existe', async () => {
      const result = await useCase.execute({
        url: 'https://test.example.com/manga/test-series/',
        refresh: false,
      })

      expect(result.status).toBe('processing')
      expect(result.sourceId).toBeTruthy()
    })

    it('deve retornar status "processing" quando refresh é true e cache existe', async () => {
      const url = 'https://test.example.com/manga/test-series/'
      const now = new Date().toISOString()
      await sharedInstances.repo.save('src-test-series-', {
        sourceId: 'src-test-series-',
        status: 'ready',
        provider: { slug: 'test-provider', name: 'Test Provider', engine: 'cheerio' },
        source: { url, language: null },
        metadata: { title: 'Test Series', author: null, description: null, status: null, genres: [] },
        chapters: [], covers: [],
        statistics: { chapters: 0, covers: 0 },
        cache: { createdAt: now, updatedAt: now, lastAccessAt: now, cacheTtlHours: 24, retentionDays: 30 },
      })

      const result = await useCase.execute({ url, refresh: true })
      expect(result.status).toBe('processing')
    })

    it('deve enfileirar job quando adquire lock', async () => {
      await useCase.execute({
        url: 'https://test.example.com/manga/test-series/',
        refresh: false,
      })

      expect(sharedInstances.queueService.enqueuedJobs).toHaveLength(1)
      expect(sharedInstances.queueService.enqueuedJobs[0].url).toBe('https://test.example.com/manga/test-series/')
    })

    it('deve retornar "processing" mesmo quando lock não é adquirido', async () => {
      sharedInstances.lockService.acquire = vi.fn().mockResolvedValue(false)

      const result = await useCase.execute({
        url: 'https://test.example.com/manga/test-series/',
        refresh: false,
      })

      expect(result.status).toBe('processing')
    })

    it('deve lançar erro para URL não suportada', async () => {
      sharedInstances.resolver.setProviders([])

      await expect(
        useCase.execute({
          url: 'https://test.example.com/manga/unsupported/',
          refresh: false,
        }),
      ).rejects.toThrow('Nenhum provider suporta a URL')
    })

    it('deve gerar sourceId determinístico', async () => {
      const result1 = await useCase.execute({
        url: 'https://test.example.com/manga/test-series/',
        refresh: false,
      })

      sharedInstances.repo.reset()
      sharedInstances.lockService.reset()
      sharedInstances.queueService.reset()

      const result2 = await useCase.execute({
        url: 'https://test.example.com/manga/test-series/',
        refresh: false,
      })

      expect(result1.sourceId).toBe(result2.sourceId)
    })
  })
})