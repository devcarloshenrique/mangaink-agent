import { describe, expect, it, vi, beforeEach } from 'vitest'
import { KNOWN_PROVIDERS } from '../../providers/known-providers'
import { RateLimitRegistry } from '../../rate-limit/rate-limit-registry'

const mockUpsertFromSeed = vi.hoisted(() => vi.fn())
const mockFindAll = vi.hoisted(() => vi.fn())
const mockLoadFromProviders = vi.hoisted(() => vi.fn())
const mockRefresh = vi.hoisted(() => vi.fn())

vi.mock('../../../../shared/database/repositories', () => ({
  getProviderRepository: () => ({
    upsertFromSeed: mockUpsertFromSeed,
    findAll: mockFindAll,
  }),
}))

vi.mock('../../utils/resolve-provider', () => ({
  getProviderResolver: () => ({
    loadFromProviders: mockLoadFromProviders,
    refresh: mockRefresh,
  }),
}))

import { initProviders, loadProviderRateLimitsFromSeed } from '../../providers/init-providers'

describe('initProviders', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('deve fazer upsert dos providers a partir do known-providers.ts', async () => {
    mockFindAll.mockResolvedValue([])

    await initProviders()

    expect(mockUpsertFromSeed).toHaveBeenCalledWith(KNOWN_PROVIDERS)
  })

  it('deve carregar as configs de rate limit do banco no resolver', async () => {
    mockUpsertFromSeed.mockResolvedValue(undefined)
    mockFindAll.mockResolvedValue([
      {
        id: '1',
        slug: 'mangalivre',
        name: 'Manga Livre',
        engine: 'cheerio',
        tags: [],
        status: 'active',
        description: null,
        urlExample: null,
        homepage: null,
        searchUrl: null,
        rateLimitMaxConcurrent: 2,
        rateLimitMinTime: 250,
        rateLimitReservoir: 30,
        rateLimitReservoirRefreshInterval: 60_000,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: '2',
        slug: 'imperiodabritannia',
        name: 'Imperio da Britannia',
        engine: 'api',
        tags: [],
        status: 'active',
        description: null,
        urlExample: null,
        homepage: null,
        searchUrl: null,
        rateLimitMaxConcurrent: 4,
        rateLimitMinTime: 150,
        rateLimitReservoir: null,
        rateLimitReservoirRefreshInterval: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ])

    await initProviders()

    expect(mockLoadFromProviders).toHaveBeenCalledWith([
      {
        slug: 'mangalivre',
        maxConcurrent: 2,
        minTime: 250,
        reservoir: 30,
        reservoirRefreshInterval: 60_000,
      },
      {
        slug: 'imperiodabritannia',
        maxConcurrent: 4,
        minTime: 150,
        reservoir: undefined,
        reservoirRefreshInterval: undefined,
      },
    ])
  })

  it('deve chamar loadFromProviders mesmo sem providers no banco', async () => {
    mockUpsertFromSeed.mockResolvedValue(undefined)
    mockFindAll.mockResolvedValue([])

    await initProviders()

    expect(mockLoadFromProviders).toHaveBeenCalledWith([])
  })

  it('deve propagar erro de banco para o try/catch do boot', async () => {
    mockUpsertFromSeed.mockRejectedValue(new Error('connection refused'))

    await expect(initProviders()).rejects.toThrow('connection refused')
  })

  it('loadProviderRateLimitsFromSeed popula o registry com os rate limits do seed (fallback do boot)', () => {
    // Simula o catch do server.ts: com o banco indisponível, o fallback carrega
    // os valores do known-providers.ts no registry — get(slug) não cai no DEFAULT.
    const registry = new RateLimitRegistry()
    mockLoadFromProviders.mockImplementation((configs) => registry.loadFromProviders(configs))

    loadProviderRateLimitsFromSeed()

    expect(registry.get('mangalivre')).toEqual({ maxConcurrent: 10, minTime: 0 })
    expect(registry.get('imperiodabritannia')).toEqual({ maxConcurrent: 2, minTime: 500 })
    expect(registry.get('mangasbrasuka')).toEqual({ maxConcurrent: 3, minTime: 200 })
    expect(registry.get('mangalivre')).not.toEqual({ maxConcurrent: 6, minTime: 50 })
  })

  it('loadProviderRateLimitsFromSeed chama loadFromProviders com a config completa do seed', () => {
    loadProviderRateLimitsFromSeed()

    const first = KNOWN_PROVIDERS[0]
    expect(mockLoadFromProviders).toHaveBeenCalledWith(
      KNOWN_PROVIDERS.map((p) => ({
        slug: p.slug,
        maxConcurrent: p.rateLimitMaxConcurrent,
        minTime: p.rateLimitMinTime,
        reservoir: p.rateLimitReservoir ?? undefined,
        reservoirRefreshInterval: p.rateLimitReservoirRefreshInterval ?? undefined,
      })),
    )
    expect(mockLoadFromProviders.mock.calls[0][0][0].slug).toBe(first.slug)
  })
})
