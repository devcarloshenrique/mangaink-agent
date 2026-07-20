import { describe, expect, it, vi, beforeEach } from 'vitest'
import { ImperioDaBritanniaStrategy } from '../../providers/imperiodabritannia/imperiodabritannia.provider'
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

describe('ImperioDaBritanniaStrategy', () => {
  let provider: ImperioDaBritanniaStrategy

  beforeEach(() => {
    vi.clearAllMocks()
    provider = new ImperioDaBritanniaStrategy(fakeLimiter)
  })

  // ─── Propriedades ───────────────────────────────────────────────────────

  describe('Propriedades', () => {
    it('deve ter slug "imperiodabritannia"', () => {
      expect(provider.slug).toBe('imperiodabritannia')
    })

    it('deve ter name "Imperio da Britannia"', () => {
      expect(provider.name).toBe('Imperio da Britannia')
    })

    it('deve ter engine "api"', () => {
      expect(provider.engine).toBe('api')
    })

    it('deve ter allowedDomains com 3 domínios', () => {
      expect(provider.allowedDomains).toEqual([
        'imperiodabritannia.net',
        'api.imperiodabritannia.net',
        'cdn.imperiodabritannia.net',
      ])
    })

    it('deve ter urlPattern que matcha URLs do ImperioDaBritannia', () => {
      expect(
        provider.urlPattern.test('https://imperiodabritannia.net/manga/test/'),
      ).toBe(true)
      expect(provider.urlPattern.test('https://example.com/test/')).toBe(false)
    })
  })

  // ─── supports ──────────────────────────────────────────────────────────

  describe('supports', () => {
    it('deve retornar true para URL do imperiodabritannia.net', () => {
      expect(
        provider.supports('https://imperiodabritannia.net/manga/meu-manga/'),
      ).toBe(true)
    })

    it('deve retornar true para URL com path /manga/', () => {
      expect(
        provider.supports('https://imperiodabritannia.net/manga/test'),
      ).toBe(true)
    })

    it('deve retornar false para URL de outro domínio', () => {
      expect(provider.supports('https://example.com/manga/test/')).toBe(false)
    })

    it('deve retornar false para URL malformada', () => {
      expect(provider.supports('not-a-url')).toBe(false)
    })

    it('deve retornar false para string vazia', () => {
      expect(provider.supports('')).toBe(false)
    })
  })

  // ─── getInfo ───────────────────────────────────────────────────────────

  describe('getInfo', () => {
    it('deve retornar ProviderInfo correto', () => {
      const info = provider.getInfo()
      expect(info.slug).toBe('imperiodabritannia')
      expect(info.name).toBe('Imperio da Britannia')
      expect(info.engine).toBe('api')
    })
  })

  // ─── inspect ───────────────────────────────────────────────────────────

  describe('inspect', () => {
    const fakeObraResponse = {
      data: {
        sucesso: true,
        obra: {
          id: 42,
          nome: 'Manga de Teste',
          descricao: 'Descrição teste',
          imagem: 'uploads/test.jpg',
          status_nome: 'Ativo',
          tags: [{ nome: 'Ação' }],
          capitulos: [
            { numero: '1.00', nome: 'Cap 1', total_paginas: 10, paywall: false },
          ],
        },
      },
    }

    it('deve retornar SourceInspectResponse no sucesso', async () => {
      mockGet.mockResolvedValue(fakeObraResponse)

      const result = await provider.inspect(
        'https://imperiodabritannia.net/manga/manga-de-teste/',
      )

      expect(result).toHaveProperty('sourceId')
      expect(result).toHaveProperty('status', 'ready')
      expect(result).toHaveProperty('provider')
      expect(result).toHaveProperty('source')
      expect(result).toHaveProperty('metadata')
      expect(result).toHaveProperty('chapters')
      expect(result).toHaveProperty('covers')
      expect(result).toHaveProperty('statistics')
    })

    it('deve lançar ScrapingNetworkError quando HTTP falha', async () => {
      mockGet.mockRejectedValue(new Error('ECONNREFUSED'))

      await expect(
        provider.inspect('https://imperiodabritannia.net/manga/test/'),
      ).rejects.toThrow(ScrapingNetworkError)
    })

    it('deve definir status como "ready"', async () => {
      mockGet.mockResolvedValue(fakeObraResponse)

      const result = await provider.inspect(
        'https://imperiodabritannia.net/manga/manga-de-teste/',
      )
      expect(result.status).toBe('ready')
    })

    it('deve incluir provider info com engine "api"', async () => {
      mockGet.mockResolvedValue(fakeObraResponse)

      const result = await provider.inspect(
        'https://imperiodabritannia.net/manga/manga-de-teste/',
      )
      expect(result.provider.engine).toBe('api')
      expect(result.provider.slug).toBe('imperiodabritannia')
    })
  })

  // ─── getChapterImages ──────────────────────────────────────────────────

  describe('getChapterImages', () => {
    it('deve retornar lista de URLs de imagens no sucesso', async () => {
      // Primeiro call: fetchObraBySlug (para obter obra_id)
      mockGet.mockResolvedValueOnce({
        data: {
          sucesso: true,
          obra: { id: 42, nome: 'Test', descricao: null, imagem: null, status_nome: null, tags: [], capitulos: [] },
        },
      })
      // Segundo call: fetchChapterPages
      mockGet.mockResolvedValueOnce({
        data: {
          sucesso: true,
          capitulo: {
            numero: '1.00',
            nome: 'Cap 1',
            paginas: [
              { numero: 1, cdn_id: 'https://cdn.imperiodabritannia.net/p1.jpg' },
              { numero: 2, cdn_id: 'https://cdn.imperiodabritannia.net/p2.jpg' },
            ],
            paywall: false,
            paywall_bloqueado: false,
            preco_moedas: null,
            capitulo_anterior: null,
            capitulo_proximo: null,
          },
        },
      })

      const images = await provider.getChapterImages(
        'https://imperiodabritannia.net/manga/test-manga/capitulo/1',
      )

      expect(images).toEqual([
        'https://cdn.imperiodabritannia.net/p1.jpg',
        'https://cdn.imperiodabritannia.net/p2.jpg',
      ])
    })

    it('deve lançar ScrapingNetworkError quando HTTP falha', async () => {
      mockGet.mockRejectedValue(new Error('Network Error'))

      await expect(
        provider.getChapterImages(
          'https://imperiodabritannia.net/manga/test/capitulo/1',
        ),
      ).rejects.toThrow(ScrapingNetworkError)
    })

    it('deve lançar erro para capítulo com paywall bloqueado', async () => {
      mockGet.mockResolvedValueOnce({
        data: {
          sucesso: true,
          obra: { id: 42, nome: 'Test', descricao: null, imagem: null, status_nome: null, tags: [], capitulos: [] },
        },
      })
      mockGet.mockResolvedValueOnce({
        data: {
          sucesso: true,
          capitulo: {
            numero: '5.00',
            nome: null,
            paginas: [],
            paywall: true,
            paywall_bloqueado: true,
            preco_moedas: 100,
            capitulo_anterior: null,
            capitulo_proximo: null,
          },
        },
      })

      await expect(
        provider.getChapterImages(
          'https://imperiodabritannia.net/manga/test/capitulo/5',
        ),
      ).rejects.toThrow(/paywall/)
    })

    it('deve lançar erro para URL de capítulo inválida', async () => {
      await expect(
        provider.getChapterImages('https://example.com/invalid-url'),
      ).rejects.toThrow()
    })
  })

  // ─── downloadImage ─────────────────────────────────────────────────────

  describe('downloadImage', () => {
    it('deve retornar buffer e contentType no sucesso', async () => {
      const fakeBuffer = Buffer.from('fake-image-data')
      mockGet.mockResolvedValue({
        data: fakeBuffer,
        headers: { 'content-type': 'image/jpeg' },
      })

      const result = await provider.downloadImage(
        'https://cdn.imperiodabritannia.net/test.jpg',
      )

      expect(result.buffer).toBeInstanceOf(Buffer)
      expect(result.contentType).toBe('image/jpeg')
    })

    it('deve lançar ScrapingNetworkError quando HTTP falha', async () => {
      mockGet.mockRejectedValue(new Error('Download failed'))

      await expect(
        provider.downloadImage('https://cdn.imperiodabritannia.net/test.jpg'),
      ).rejects.toThrow(ScrapingNetworkError)
    })
  })
})
