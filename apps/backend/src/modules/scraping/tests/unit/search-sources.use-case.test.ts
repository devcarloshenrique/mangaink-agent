import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  SearchSourcesUseCase,
  UnknownProviderError,
  __resetSearchCacheForTests,
} from '../../use-cases/search-sources.use-case'
import { ScrapingNetworkError, ScrapingParseError } from '../../errors/scraping.errors'
import type { ProviderRepository } from '../../repositories/provider.repository'
import { MockScrapingProvider } from '../helpers/mock-scraping-provider'

function createProviderRepo(statuses: string[]): ProviderRepository {
  const records = statuses.map((status, i) => ({
    slug: `p${i}`,
    name: `P${i}`,
    engine: 'api' as const,
    tags: [],
    status,
    homepage: null,
    rateLimitMaxConcurrent: 6,
    rateLimitMinTime: 50,
    rateLimitReservoir: null,
    rateLimitReservoirRefreshInterval: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }))
  return {
    findAll: vi.fn().mockResolvedValue(records),
    findBySlug: vi.fn(),
    upsertFromSeed: vi.fn(),
    update: vi.fn(),
  }
}

describe('SearchSourcesUseCase', () => {
  beforeEach(() => {
    __resetSearchCacheForTests()
  })

  it('agrega resultados e converte falha em errors[]', async () => {
    const ok = new MockScrapingProvider()
    Object.defineProperty(ok, 'slug', { value: 'p0' })
    ok.setSearchResult([
      { providerSlug: 'p0', title: 'One Piece', url: 'https://x/manga/one-piece/' },
    ])
    const failing = new MockScrapingProvider()
    Object.defineProperty(failing, 'slug', { value: 'p1' })
    failing.setSearchError(new Error('timeout'))
    const useCase = new SearchSourcesUseCase(
      createProviderRepo(['active', 'active']),
      () => [ok, failing],
    )
    const result = await useCase.execute({ query: 'one piece' })
    expect(result.results).toHaveLength(1)
    expect(result.errors).toEqual([{ providerSlug: 'p1', message: 'timeout' }])
    expect(result.searchedProviders).toEqual(['p0', 'p1'])
    expect(result.truncated).toBe(false)
  })

  it('limita default a 10 providers com truncated=true e pico ≤6', async () => {
    let inFlight = 0
    let peak = 0
    const strategies = Array.from({ length: 30 }, (_, i) => {
      const p = new MockScrapingProvider()
      Object.defineProperty(p, 'slug', { value: `p${i}` })
      p.setSearchResult([])
      const orig = p.search.bind(p)
      p.search = async (...args: Parameters<typeof orig>) => {
        inFlight += 1
        peak = Math.max(peak, inFlight)
        await new Promise((r) => setTimeout(r, 50))
        inFlight -= 1
        return orig(...args)
      }
      return p
    })
    const useCase = new SearchSourcesUseCase(
      createProviderRepo(Array(30).fill('active')),
      () => strategies,
    )
    const result = await useCase.execute({ query: 'naruto' })
    expect(result.searchedProviders).toHaveLength(10)
    expect(result.truncated).toBe(true)
    expect(peak).toBeLessThanOrEqual(6)
  })

  it('timeout por provider vira errors[] em <2s', async () => {
    const hanging = new MockScrapingProvider()
    Object.defineProperty(hanging, 'slug', { value: 'p0' })
    hanging.search = () => new Promise(() => {})
    const useCase = new SearchSourcesUseCase(createProviderRepo(['active']), () => [hanging])
    const start = Date.now()
    const result = await useCase.execute({ query: 'bleach', timeoutMs: 200 })
    expect(Date.now() - start).toBeLessThan(2000)
    expect(result.results).toEqual([])
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]?.providerSlug).toBe('p0')
  })

  it('cacheia a mesma query (strategy chamada 1x)', async () => {
    const ok = new MockScrapingProvider()
    Object.defineProperty(ok, 'slug', { value: 'p0' })
    const spy = vi.spyOn(ok, 'search')
    ok.setSearchResult([
      { providerSlug: 'p0', title: 'One Piece', url: 'https://x/manga/one-piece/' },
    ])
    const useCase = new SearchSourcesUseCase(createProviderRepo(['active']), () => [ok])
    await useCase.execute({ query: 'One Piece' })
    await useCase.execute({ query: 'one piece' })
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('rejeita slug explícito desconhecido com UnknownProviderError (statusCode 400) se todos forem desconhecidos', async () => {
    const ok = new MockScrapingProvider()
    Object.defineProperty(ok, 'slug', { value: 'p0' })
    const useCase = new SearchSourcesUseCase(createProviderRepo(['active']), () => [ok])
    await expect(useCase.execute({ query: 'naruto', providers: ['xxx'] })).rejects.toBeInstanceOf(
      UnknownProviderError,
    )
    await expect(
      useCase.execute({ query: 'naruto', providers: ['xxx'] }),
    ).rejects.toMatchObject({ statusCode: 400 })
  })

  it('tolera e filtra slug desconhecido se houver pelo menos um provider válido', async () => {
    const ok = new MockScrapingProvider()
    Object.defineProperty(ok, 'slug', { value: 'p0' })
    ok.setSearchResult([
      { providerSlug: 'p0', title: 'Naruto', url: 'https://p0/manga/naruto/' },
    ])
    const useCase = new SearchSourcesUseCase(createProviderRepo(['active']), () => [ok])
    const res = await useCase.execute({ query: 'naruto', providers: ['p0', 'obsoleto'] })
    expect(res.searchedProviders).toEqual(['p0'])
    expect(res.results).toHaveLength(1)
  })

  it('provider explícito offline não entra no fan-out', async () => {
    const online = new MockScrapingProvider()
    Object.defineProperty(online, 'slug', { value: 'p0' })
    online.setSearchResult([
      { providerSlug: 'p0', title: 'One Piece', url: 'https://x/manga/one-piece/' },
    ])
    const offline = new MockScrapingProvider()
    Object.defineProperty(offline, 'slug', { value: 'p1' })
    const spy = vi.spyOn(offline, 'search')
    const useCase = new SearchSourcesUseCase(
      createProviderRepo(['active', 'offline']),
      () => [online, offline],
    )
    const result = await useCase.execute({ query: 'one piece', providers: ['p0', 'p1'] })
    expect(result.searchedProviders).toEqual(['p0'])
    expect(spy).not.toHaveBeenCalled()
  })

  it('sanitiza ScrapingNetworkError/ScrapingParseError em errors[] sem corpo cru', async () => {
    const net = new MockScrapingProvider()
    Object.defineProperty(net, 'slug', { value: 'p0' })
    net.setSearchError(new ScrapingNetworkError('https://internal/upstream?token=abc'))
    const parse = new MockScrapingProvider()
    Object.defineProperty(parse, 'slug', { value: 'p1' })
    parse.setSearchError(new ScrapingParseError('<html>raw body</html>'))
    const useCase = new SearchSourcesUseCase(
      createProviderRepo(['active', 'active']),
      () => [net, parse],
    )
    const result = await useCase.execute({
      query: 'one piece',
      providers: ['p0', 'p1'],
      timeoutMs: 1000,
    })
    expect(result.errors).toEqual([
      { providerSlug: 'p0', message: 'Falha no provider p0' },
      { providerSlug: 'p1', message: 'Falha no provider p1' },
    ])
    for (const e of result.errors) {
      expect(e.message).not.toContain('internal')
      expect(e.message).not.toContain('<html>')
    }
  })

  it('repassa offsetPerProvider para strategy.search', async () => {
    const ok = new MockScrapingProvider()
    Object.defineProperty(ok, 'slug', { value: 'p0' })
    const spy = vi.spyOn(ok, 'search')
    ok.setSearchResult([
      { providerSlug: 'p0', title: 'One Piece', url: 'https://x/manga/one-piece/' },
    ])
    const useCase = new SearchSourcesUseCase(createProviderRepo(['active']), () => [ok])
    await useCase.execute({ query: 'One Piece', offsetPerProvider: 10, limitPerProvider: 10 })
    expect(spy).toHaveBeenCalledWith(
      'One Piece',
      expect.objectContaining({ limit: 10, offset: 10 }),
    )
  })

  it('dá bypass no cache em memória quando offsetPerProvider > 0', async () => {
    const ok = new MockScrapingProvider()
    Object.defineProperty(ok, 'slug', { value: 'p0' })
    const spy = vi.spyOn(ok, 'search')
    ok.setSearchResult([
      { providerSlug: 'p0', title: 'One Piece', url: 'https://x/manga/one-piece/' },
    ])
    const useCase = new SearchSourcesUseCase(createProviderRepo(['active']), () => [ok])
    await useCase.execute({ query: 'One Piece', offsetPerProvider: 10 })
    await useCase.execute({ query: 'One Piece', offsetPerProvider: 10 })
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('faz wrap de coverUrl com cover-proxy para providers com proteção contra hotlink', async () => {
    const kakalot = new MockScrapingProvider()
    Object.defineProperty(kakalot, 'slug', { value: 'mangakakalot' })
    kakalot.setSearchResult([
      {
        providerSlug: 'mangakakalot',
        title: 'Naruto',
        url: 'https://mangakakalot.gg/manga/naruto',
        coverUrl: 'https://img-r1.2xstorage.com/thumb/naruto.webp',
      },
    ])

    const normal = new MockScrapingProvider()
    Object.defineProperty(normal, 'slug', { value: 'imperiodabritannia' })
    normal.setSearchResult([
      {
        providerSlug: 'imperiodabritannia',
        title: 'Naruto',
        url: 'https://imperiodabritannia.net/manga/naruto',
        coverUrl: 'https://cdn.example.com/cover.webp',
      },
    ])

    const useCase = new SearchSourcesUseCase(
      createProviderRepo(['active']),
      () => [kakalot, normal],
    )

    const res = await useCase.execute({
      query: 'Naruto',
      providers: ['mangakakalot', 'imperiodabritannia'],
    })

    const kakalotItem = res.results.find((r) => r.providerSlug === 'mangakakalot')
    const normalItem = res.results.find((r) => r.providerSlug === 'imperiodabritannia')

    expect(kakalotItem?.coverUrl).toBe(
      '/api/conversions/source/cover-proxy?url=https%3A%2F%2Fimg-r1.2xstorage.com%2Fthumb%2Fnaruto.webp&provider=mangakakalot',
    )
    expect(normalItem?.coverUrl).toBe('https://cdn.example.com/cover.webp')
  })
})
