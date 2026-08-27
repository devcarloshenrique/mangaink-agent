import { describe, expect, it, beforeEach, vi } from 'vitest'

const mockCreateRateLimiter = vi.hoisted(() => vi.fn())

vi.mock('../../rate-limit/rate-limiter', () => ({
  createRateLimiter: mockCreateRateLimiter,
}))

import { ProviderResolver } from '../../providers/provider-resolver'
import { ProviderNotFoundError, InvalidUrlError } from '../../errors/scraping.errors'
import {
  getProviderResolver,
  refreshProviderResolver,
  resetProviderResolver,
} from '../../utils/resolve-provider'

describe('ProviderResolver', () => {
  let resolver: ProviderResolver

  beforeEach(() => {
    mockCreateRateLimiter.mockReset()
    mockCreateRateLimiter.mockImplementation(() => ({}))
    resetProviderResolver()
    resolver = new ProviderResolver()
  })

  describe('resolve', () => {
    it('deve resolver provider para URL do MangaLivre', () => {
      const provider = resolver.resolve('https://mangalivre.to/manga/hunter-x-hunter/')
      expect(provider.slug).toBe('mangalivre')
      expect(provider.name).toBe('Manga Livre')
      expect(provider.engine).toBe('cheerio')
    })

    it('deve resolver provider para URL sem barra final', () => {
      const provider = resolver.resolve('https://mangalivre.to/manga/hunter-x-hunter')
      expect(provider.slug).toBe('mangalivre')
    })

    it('deve lançar ProviderNotFoundError para URL não suportada', () => {
      expect(() => resolver.resolve('https://example.com/manga/test/')).toThrow(
        ProviderNotFoundError,
      )
    })

    it('deve lançar InvalidUrlError para URL malformada', () => {
      expect(() => resolver.resolve('not-a-url')).toThrow(InvalidUrlError)
    })

    it('deve lançar InvalidUrlError para string vazia', () => {
      expect(() => resolver.resolve('')).toThrow(InvalidUrlError)
    })

    it('deve proteger contra SSRF (domínios não autorizados)', () => {
      expect(() => resolver.resolve('https://evil.com/manga/test/')).toThrow(ProviderNotFoundError)
    })

    it('deve ser case-sensitive para hostname', () => {
      const provider = resolver.resolve('https://MANGALIVRE.to/manga/test/')
      expect(provider.slug).toBe('mangalivre')
    })

    it('deve resolver provider para URL do ImperioDaBritannia', () => {
      const provider = resolver.resolve('https://imperiodabritannia.net/manga/meu-manga/')
      expect(provider.slug).toBe('imperiodabritannia')
      expect(provider.name).toBe('Imperio da Britannia')
      expect(provider.engine).toBe('api')
    })

    it('deve resolver provider para URL do ImperioDaBritannia sem barra final', () => {
      const provider = resolver.resolve('https://imperiodabritannia.net/manga/meu-manga')
      expect(provider.slug).toBe('imperiodabritannia')
    })

    it('deve resolver provider para URL do Mangas Brasukas', () => {
      const provider = resolver.resolve(
        'https://mangasbrasuka.com.br/manga/mushoku-tensei-jobless-reincarnation/',
      )
      expect(provider.slug).toBe('mangasbrasuka')
      expect(provider.name).toBe('Mangas Brasukas')
      expect(provider.engine).toBe('api')
    })

    it('deve resolver provider para URL do Mangas Brasukas sem barra final', () => {
      const provider = resolver.resolve('https://mangasbrasuka.com.br/manhwa/meu-manga')
      expect(provider.slug).toBe('mangasbrasuka')
    })
  })

  describe('listAll', () => {
    it('deve listar todos os providers disponíveis', () => {
      const providers = resolver.listAll()
      expect(providers).toHaveLength(4)
      const slugs = providers.map((p) => p.slug)
      expect(slugs).toContain('mangalivre')
      expect(slugs).toContain('imperiodabritannia')
      expect(slugs).toContain('mangasbrasuka')
      expect(slugs).toContain('mangadex')
    })

    it('deve retornar providers com informações completas', () => {
      const [provider] = resolver.listAll()
      expect(provider).toHaveProperty('slug')
      expect(provider).toHaveProperty('name')
      expect(provider).toHaveProperty('engine')
      expect(provider).toHaveProperty('urlPattern')
      expect(provider).toHaveProperty('allowedDomains')
    })
  })

  describe('loadFromProviders', () => {
    it('alimenta o registry e reconstrói providers com as novas configs', () => {
      resolver.loadFromProviders([{ slug: 'mangalivre', maxConcurrent: 2, minTime: 300 }])

      expect(mockCreateRateLimiter).toHaveBeenCalledWith({ maxConcurrent: 2, minTime: 300 })
      expect(mockCreateRateLimiter).toHaveBeenCalledWith({ maxConcurrent: 6, minTime: 50 })
    })
  })

  describe('refresh', () => {
    it('preserva instâncias Bottleneck quando a config não muda', () => {
      const before = resolver.listAll().map((p) => p.rateLimiter)

      resolver.loadFromProviders([
        { slug: 'mangalivre', maxConcurrent: 6, minTime: 50 },
        { slug: 'imperiodabritannia', maxConcurrent: 6, minTime: 50 },
        { slug: 'mangasbrasuka', maxConcurrent: 6, minTime: 50 },
        { slug: 'mangadex', maxConcurrent: 6, minTime: 50 },
      ])

      const after = resolver.listAll().map((p) => p.rateLimiter)
      expect(after).toEqual(before)
      expect(mockCreateRateLimiter).toHaveBeenCalledTimes(4)
    })

    it('reconstrói limiter quando a config muda', () => {
      const before = resolver.listAll().find((p) => p.slug === 'mangalivre')!.rateLimiter

      resolver.loadFromProviders([{ slug: 'mangalivre', maxConcurrent: 2, minTime: 300 }])

      const after = resolver.listAll().find((p) => p.slug === 'mangalivre')!.rateLimiter
      expect(after).not.toBe(before)
      expect(mockCreateRateLimiter).toHaveBeenCalledTimes(5)
    })

    it('preserva limiters dos demais providers quando só um muda', () => {
      const beforeBritannia = resolver
        .listAll()
        .find((p) => p.slug === 'imperiodabritannia')!.rateLimiter

      resolver.loadFromProviders([{ slug: 'mangalivre', maxConcurrent: 2, minTime: 300 }])

      const afterBritannia = resolver
        .listAll()
        .find((p) => p.slug === 'imperiodabritannia')!.rateLimiter
      expect(afterBritannia).toBe(beforeBritannia)
      expect(mockCreateRateLimiter).toHaveBeenCalledTimes(5)
    })

    it('mantém todos os providers após refresh', () => {
      resolver.loadFromProviders([{ slug: 'mangalivre', maxConcurrent: 2, minTime: 300 }])

      expect(resolver.listAll().map((p) => p.slug)).toEqual([
        'mangalivre',
        'imperiodabritannia',
        'mangasbrasuka',
        'mangadex',
      ])
    })
  })

  describe('singleton (getProviderResolver/refreshProviderResolver)', () => {
    it('retorna a mesma instância para chamadas repetidas', () => {
      const first = getProviderResolver()
      const second = getProviderResolver()
      expect(first).toBe(second)
    })

    it('é uma instância real de ProviderResolver com listAll', () => {
      const resolverInstance = getProviderResolver()
      expect(resolverInstance).toBeInstanceOf(ProviderResolver)
      expect(resolverInstance.listAll().map((p) => p.slug)).toEqual([
        'mangalivre',
        'imperiodabritannia',
        'mangasbrasuka',
        'mangadex',
      ])
    })

    it('refreshProviderResolver preserva a instância do singleton', () => {
      const before = getProviderResolver()
      refreshProviderResolver()
      expect(getProviderResolver()).toBe(before)
    })

    it('refreshProviderResolver preserva as configs carregadas (registry não reseta)', () => {
      const resolverInstance = getProviderResolver()
      resolverInstance.loadFromProviders([{ slug: 'mangalivre', maxConcurrent: 2, minTime: 300 }])
      const before = resolverInstance.listAll().find((p) => p.slug === 'mangalivre')!.rateLimiter

      refreshProviderResolver()

      const after = resolverInstance.listAll().find((p) => p.slug === 'mangalivre')!.rateLimiter
      expect(after).toBe(before)
      expect(mockCreateRateLimiter).toHaveBeenLastCalledWith({ maxConcurrent: 2, minTime: 300 })
    })

    it('resetProviderResolver descarta a instância do singleton', () => {
      const first = getProviderResolver()
      resetProviderResolver()
      const second = getProviderResolver()
      expect(second).not.toBe(first)
    })
  })
})
