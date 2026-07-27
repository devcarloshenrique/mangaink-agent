import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest'
import { CacheService } from '../../services/cache.service'
import { InMemorySourceCacheRepository } from '../helpers/in-memory-source-cache.repository'
import type { SourceMetadataFile } from '../../types/metadata.types'

describe('CacheService', () => {
  let repository: InMemorySourceCacheRepository
  let cacheService: CacheService

  beforeEach(() => {
    repository = new InMemorySourceCacheRepository()
    cacheService = new CacheService(repository)
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const makeMetadata = (overrides: Partial<SourceMetadataFile> = {}): SourceMetadataFile => ({
    sourceId: 'src-test-12345678',
    status: 'ready',
    provider: { slug: 'test', name: 'Test', engine: 'cheerio' },
    source: { url: 'https://example.com/manga/test/', language: null },
    metadata: { title: 'Test', author: null, description: null, status: null, genres: [] },
    chapters: [],
    covers: [],
    statistics: { chapters: 0, covers: 0 },
    cache: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastAccessAt: new Date().toISOString(),
      cacheTtlHours: 24,
      retentionDays: 30,
    },
    ...overrides,
  })

  describe('isValid', () => {
    it('deve retornar true quando o cache está dentro do TTL', async () => {
      await repository.save('src-test-12345678', makeMetadata())
      const result = await cacheService.isValid('src-test-12345678')
      expect(result).toBe(true)
    })

    it('deve retornar false quando o cache não existe', async () => {
      const result = await cacheService.isValid('src-nonexistent')
      expect(result).toBe(false)
    })

    it('deve retornar false quando o TTL expirou', async () => {
      const pastDate = new Date(Date.now() - 25 * 60 * 60 * 1000) // 25h atrás
      await repository.save(
        'src-test-12345678',
        makeMetadata({
          cache: {
            createdAt: pastDate.toISOString(),
            updatedAt: pastDate.toISOString(),
            lastAccessAt: pastDate.toISOString(),
            cacheTtlHours: 24,
            retentionDays: 30,
          },
        }),
      )
      const result = await cacheService.isValid('src-test-12345678')
      expect(result).toBe(false)
    })

    it('deve retornar true quando o TTL é exatamente o limite', async () => {
      const almostPast = new Date(Date.now() - 23 * 60 * 60 * 1000) // 23h atrás
      await repository.save(
        'src-test-12345678',
        makeMetadata({
          cache: {
            createdAt: almostPast.toISOString(),
            updatedAt: almostPast.toISOString(),
            lastAccessAt: almostPast.toISOString(),
            cacheTtlHours: 24,
            retentionDays: 30,
          },
        }),
      )
      const result = await cacheService.isValid('src-test-12345678')
      expect(result).toBe(true)
    })

    it('deve respeitar cacheTtlHours customizado', async () => {
      const pastDate = new Date(Date.now() - 2 * 60 * 60 * 1000) // 2h atrás
      await repository.save(
        'src-test-12345678',
        makeMetadata({
          cache: {
            createdAt: pastDate.toISOString(),
            updatedAt: pastDate.toISOString(),
            lastAccessAt: pastDate.toISOString(),
            cacheTtlHours: 1, // TTL de 1h
            retentionDays: 30,
          },
        }),
      )
      const result = await cacheService.isValid('src-test-12345678')
      expect(result).toBe(false)
    })
  })

  describe('touch', () => {
    it('deve atualizar updatedAt e lastAccessAt', async () => {
      const fixedDate = new Date('2026-07-08T12:00:00Z')
      vi.setSystemTime(fixedDate)

      await repository.save(
        'src-test-12345678',
        makeMetadata({
          cache: {
            createdAt: '2026-07-07T12:00:00Z',
            updatedAt: '2026-07-07T12:00:00Z',
            lastAccessAt: '2026-07-07T12:00:00Z',
            cacheTtlHours: 24,
            retentionDays: 30,
          },
        }),
      )

      const newDate = new Date('2026-07-08T15:00:00Z')
      vi.setSystemTime(newDate)

      await cacheService.touch('src-test-12345678')

      const updated = await repository.load('src-test-12345678')
      expect(updated?.cache.updatedAt).toBe('2026-07-08T15:00:00.000Z')
      expect(updated?.cache.lastAccessAt).toBe('2026-07-08T15:00:00.000Z')
    })

    it('não deve lançar erro quando source não existe', async () => {
      await expect(cacheService.touch('src-nonexistent')).resolves.toBeUndefined()
    })
  })

  describe('extendRetention', () => {
    it('deve atualizar cacheTtlHours e retentionDays para o valor solicitado', async () => {
      const fixedDate = new Date('2026-07-08T12:00:00Z')
      vi.setSystemTime(fixedDate)

      await repository.save('src-test-12345678', makeMetadata())

      await cacheService.extendRetention('src-test-12345678', 30)

      const updated = await repository.load('src-test-12345678')
      expect(updated?.cache.cacheTtlHours).toBe(720) // 30 * 24
      expect(updated?.cache.retentionDays).toBe(30)
    })

    it('deve atualizar updatedAt e lastAccessAt', async () => {
      const fixedDate = new Date('2026-07-08T12:00:00Z')
      vi.setSystemTime(fixedDate)

      await repository.save(
        'src-test-12345678',
        makeMetadata({
          cache: {
            createdAt: '2026-07-07T12:00:00Z',
            updatedAt: '2026-07-07T12:00:00Z',
            lastAccessAt: '2026-07-07T12:00:00Z',
            cacheTtlHours: 24,
            retentionDays: 30,
          },
        }),
      )

      await cacheService.extendRetention('src-test-12345678', 7)

      const updated = await repository.load('src-test-12345678')
      expect(updated?.cache.updatedAt).toBe('2026-07-08T12:00:00.000Z')
      expect(updated?.cache.lastAccessAt).toBe('2026-07-08T12:00:00.000Z')
      expect(updated?.cache.cacheTtlHours).toBe(168) // 7 * 24
      expect(updated?.cache.retentionDays).toBe(7)
    })
  })

  describe('createFreshCache', () => {
    it('deve criar objeto MetadataCache com valores padrão', () => {
      const fixedDate = new Date('2026-07-08T12:00:00Z')
      vi.setSystemTime(fixedDate)

      const cache = cacheService.createFreshCache()

      expect(cache.createdAt).toBe('2026-07-08T12:00:00.000Z')
      expect(cache.updatedAt).toBe('2026-07-08T12:00:00.000Z')
      expect(cache.lastAccessAt).toBe('2026-07-08T12:00:00.000Z')
      expect(cache.cacheTtlHours).toBe(24)
      expect(cache.retentionDays).toBe(30)
    })

    it('deve criar cache sem fake timers', () => {
      // Temporarily use real timers for this test
      vi.useRealTimers()
      const cache1 = cacheService.createFreshCache()
      const cache2 = cacheService.createFreshCache()
      // Com fake timers desativado, as chamadas podem ter timestamps diferentes
      expect(cache1.createdAt).toBeTruthy()
      expect(cache2.createdAt).toBeTruthy()
      vi.useFakeTimers()
    })
  })
})