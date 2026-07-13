import { describe, expect, it, vi, beforeEach } from 'vitest'
import { MangaLivreStrategy } from '../../providers/mangalivre/mangalivre.provider'
import { ScrapingNetworkError } from '../../errors/scraping.errors'
import type { RateLimiter } from '../../rate-limit/types'

const mockGet = vi.hoisted(() => vi.fn())

vi.mock('../../../../shared/http/http-client', () => ({
  createHttpClient: vi.fn(() => ({
    get: mockGet,
  })),
}))

const fakeLimiter: RateLimiter = {
  schedule: (fn: () => Promise<unknown>) => fn(),
} as unknown as RateLimiter

describe('MangaLivreStrategy', () => {
  let provider: MangaLivreStrategy

  beforeEach(() => {
    provider = new MangaLivreStrategy(fakeLimiter)
  })

  describe('supports', () => {
    it('deve retornar true para URL do mangalivre.to', () => {
      expect(provider.supports('https://mangalivre.to/manga/hunter-x-hunter/')).toBe(true)
    })

    it('deve retornar true para URL com subdomínio', () => {
      expect(provider.supports('https://mangalivre.to/manga/test/')).toBe(true)
    })

    it('deve retornar false para URL de outro domínio', () => {
      expect(provider.supports('https://example.com/manga/test/')).toBe(false)
    })

    it('deve retornar false para URL malformada', () => {
      expect(provider.supports('not-a-url')).toBe(false)
    })

    it('deve retornar false para URL vazia', () => {
      expect(provider.supports('')).toBe(false)
    })
  })

  describe('getInfo', () => {
    it('deve retornar informações do provider', () => {
      const info = provider.getInfo()
      expect(info.slug).toBe('mangalivre')
      expect(info.name).toBe('Manga Livre')
      expect(info.engine).toBe('cheerio')
    })
  })

  describe('inspect', () => {
    it('deve lançar ScrapingNetworkError quando HTTP falha', async () => {
      mockGet.mockRejectedValue(new Error('ECONNREFUSED'))

      await expect(provider.inspect('https://mangalivre.to/manga/test/')).rejects.toThrow(ScrapingNetworkError)
    })

    it('deve retornar SourceInspectResponse no sucesso', async () => {
      mockGet.mockResolvedValue({
        data: '<html><body><h1>Test Manga</h1></body></html>',
      })

      const result = await provider.inspect('https://mangalivre.to/manga/test-manga/')

      expect(result).toHaveProperty('sourceId')
      expect(result).toHaveProperty('status', 'ready')
      expect(result).toHaveProperty('provider')
      expect(result).toHaveProperty('source')
      expect(result).toHaveProperty('metadata')
      expect(result).toHaveProperty('chapters')
      expect(result).toHaveProperty('covers')
      expect(result).toHaveProperty('statistics')
    })

    it('deve definir status como "ready"', async () => {
      mockGet.mockResolvedValue({
        data: '<html><body><h1>Test</h1></body></html>',
      })

      const result = await provider.inspect('https://mangalivre.to/manga/test/')
      expect(result.status).toBe('ready')
    })
  })

  describe('Propriedades', () => {
    it('deve ter slug "mangalivre"', () => {
      expect(provider.slug).toBe('mangalivre')
    })

    it('deve ter engine "cheerio"', () => {
      expect(provider.engine).toBe('cheerio')
    })

    it('deve ter allowedDomains com mangalivre.to', () => {
      expect(provider.allowedDomains).toEqual(['mangalivre.to'])
    })

    it('deve ter urlPattern que matcha URLs do MangaLivre', () => {
      expect(provider.urlPattern.test('https://mangalivre.to/manga/test/')).toBe(true)
      expect(provider.urlPattern.test('https://example.com/test/')).toBe(false)
    })
  })
})