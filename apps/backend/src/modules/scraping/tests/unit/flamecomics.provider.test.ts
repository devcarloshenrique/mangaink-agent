import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { RateLimiter } from '../../rate-limit/types'
import { FlameComicsStrategy } from '../../providers/flamecomics/flamecomics.provider'
import { ScrapingNetworkError, ScrapingParseError } from '../../errors/scraping.errors'

const mockGet = vi.hoisted(() => vi.fn())

vi.mock('../../../../shared/http/http-client', () => ({
  createHttpClient: vi.fn(() => ({
    get: mockGet,
  })),
}))

const fakeLimiter: RateLimiter = {
  schedule: (fn: () => Promise<unknown>) => fn(),
} as unknown as RateLimiter

describe('FlameComicsStrategy', () => {
  let provider: FlameComicsStrategy

  beforeEach(() => {
    vi.clearAllMocks()
    provider = new FlameComicsStrategy(fakeLimiter)
  })

  // ─── Propriedades ───────────────────────────────────────────────────────

  describe('Propriedades', () => {
    it('deve ter slug "flamecomics"', () => {
      expect(provider.slug).toBe('flamecomics')
    })

    it('deve ter name "Flame Comics"', () => {
      expect(provider.name).toBe('Flame Comics')
    })

    it('deve ter engine "cheerio"', () => {
      expect(provider.engine).toBe('cheerio')
    })

    it('deve ter allowedDomains com domínios do Flame Comics e CDN', () => {
      expect(provider.allowedDomains).toContain('flamecomics.xyz')
      expect(provider.allowedDomains).toContain('flamecomics.me')
      expect(provider.allowedDomains).toContain('flamecomics.com')
      expect(provider.allowedDomains).toContain('cdn.flamecomics.xyz')
      expect(provider.allowedDomains).toContain('flamescans.org')
    })

    it('deve ter urlPattern que matcha URLs do Flame Comics', () => {
      expect(provider.urlPattern.test('https://flamecomics.xyz/series/2')).toBe(true)
      expect(provider.urlPattern.test('https://flamecomics.xyz/series/2/')).toBe(true)
      expect(
        provider.urlPattern.test(
          'https://flamecomics.xyz/series/2-omniscient-readers-viewpoint',
        ),
      ).toBe(true)
      expect(
        provider.urlPattern.test('https://flamecomics.xyz/series/2/364db6fd6bef182e'),
      ).toBe(true)
      expect(provider.urlPattern.test('https://flamecomics.me/series/2')).toBe(true)
      expect(provider.urlPattern.test('https://flamecomics.com/series/2')).toBe(true)
      expect(provider.urlPattern.test('https://example.com/series/2')).toBe(false)
    })
  })

  // ─── supports ──────────────────────────────────────────────────────────

  describe('supports', () => {
    it('deve retornar true para URL do flamecomics.xyz', () => {
      expect(provider.supports('https://flamecomics.xyz/series/2')).toBe(true)
      expect(
        provider.supports('https://flamecomics.xyz/series/2/364db6fd6bef182e'),
      ).toBe(true)
    })

    it('deve retornar true para URL do flamecomics.me', () => {
      expect(provider.supports('https://flamecomics.me/series/2')).toBe(true)
    })

    it('deve retornar true para URL do flamecomics.com', () => {
      expect(provider.supports('https://flamecomics.com/series/2')).toBe(true)
    })

    it('deve retornar false para outros domínios', () => {
      expect(provider.supports('https://mangalivre.net/manga/solo-leveling')).toBe(false)
      expect(provider.supports('https://google.com')).toBe(false)
    })

    it('deve retornar false para URLs inválidas', () => {
      expect(provider.supports('not-a-valid-url')).toBe(false)
    })
  })

  // ─── getInfo ───────────────────────────────────────────────────────────

  describe('getInfo', () => {
    it('deve retornar ProviderInfo com metadados corretos', () => {
      const info = provider.getInfo()
      expect(info.slug).toBe('flamecomics')
      expect(info.name).toBe('Flame Comics')
      expect(info.engine).toBe('cheerio')
    })
  })

  // ─── search ────────────────────────────────────────────────────────────

  describe('search', () => {
    it('deve buscar usando a API interna /api/series com sucesso', async () => {
      mockGet.mockResolvedValueOnce({
        data: [
          {
            id: 2,
            label: "Omniscient Reader's Viewpoint",
            image: 'thumbnail.png',
            status: 'Ongoing',
          },
          {
            id: 149,
            label: 'Black Haze (2025)',
            image: 'thumbnail.png',
            status: 'Ongoing',
          },
        ],
      })

      const results = await provider.search('reader')

      expect(mockGet).toHaveBeenCalledWith('https://flamecomics.xyz/api/series', {
        signal: undefined,
      })
      expect(results).toHaveLength(1)
      expect(results[0].title).toBe("Omniscient Reader's Viewpoint")
      expect(results[0].url).toBe('https://flamecomics.xyz/series/2')
      expect(results[0].coverUrl).toBe(
        'https://cdn.flamecomics.xyz/uploads/images/series/2/thumbnail.png',
      )
    })

    it('deve fazer fallback para /browse se a API falhar', async () => {
      mockGet.mockRejectedValueOnce(new Error('API error'))
      mockGet.mockResolvedValueOnce({
        data: `
          <html>
            <body>
              <script id="__NEXT_DATA__" type="application/json">
                {
                  "props": {
                    "pageProps": {
                      "series": [
                        {
                          "series_id": 50,
                          "title": "Solo Leveling",
                          "cover": "cover.jpg",
                          "author": ["Chugong"]
                        }
                      ]
                    }
                  }
                }
              </script>
            </body>
          </html>
        `,
      })

      const results = await provider.search('solo')

      expect(mockGet).toHaveBeenCalledWith('https://flamecomics.xyz/browse', {
        signal: undefined,
      })
      expect(results).toHaveLength(1)
      expect(results[0].title).toBe('Solo Leveling')
      expect(results[0].author).toBe('Chugong')
    })

    it('deve lançar ScrapingNetworkError se API e fallback falharem', async () => {
      mockGet.mockRejectedValueOnce(new Error('API down'))
      mockGet.mockRejectedValueOnce(new Error('Browse down'))

      await expect(provider.search('test')).rejects.toThrow(ScrapingNetworkError)
    })
  })

  // ─── inspect ───────────────────────────────────────────────────────────

  describe('inspect', () => {
    it('deve lançar ScrapingParseError se URL não for suportada', async () => {
      await expect(provider.inspect('https://invalid.com/series/2')).rejects.toThrow(
        ScrapingParseError,
      )
    })

    it('deve inspecionar obra com sucesso', async () => {
      mockGet.mockResolvedValueOnce({
        data: `
          <html>
            <body>
              <script id="__NEXT_DATA__" type="application/json">
                {
                  "props": {
                    "pageProps": {
                      "series": {
                        "series_id": 2,
                        "title": "Omniscient Reader's Viewpoint",
                        "description": "<p>Sinopse completa</p>",
                        "status": "Ongoing",
                        "author": ["Sing Shong"],
                        "artist": ["Sleepy-C"],
                        "tags": ["Action", "Fantasy"],
                        "cover": "thumbnail.png"
                      },
                      "chapters": [
                        {
                          "chapter_id": 100,
                          "series_id": 2,
                          "chapter": "1.00",
                          "title": "Capítulo 1",
                          "token": "tok1",
                          "release_date": 1600000000
                        }
                      ]
                    }
                  }
                }
              </script>
            </body>
          </html>
        `,
      })

      const result = await provider.inspect('https://flamecomics.xyz/series/2')

      expect(result.metadata.title).toBe("Omniscient Reader's Viewpoint")
      expect(result.metadata.status).toBe('ongoing')
      expect(result.metadata.author).toBe('Sing Shong')
      expect(result.chapters).toHaveLength(1)
      expect(result.chapters[0].number).toBe('1')
      expect(result.covers).toHaveLength(1)
    })

    it('deve normalizar URL se for passado link de capítulo', async () => {
      mockGet.mockResolvedValueOnce({
        data: `
          <html>
            <body>
              <h1>Omniscient Reader's Viewpoint</h1>
              <a href="/series/2/tok1">Capítulo 1</a>
            </body>
          </html>
        `,
      })

      const result = await provider.inspect('https://flamecomics.xyz/series/2/364db6fd6bef182e')

      expect(mockGet).toHaveBeenCalledWith('https://flamecomics.xyz/series/2', {
        signal: undefined,
      })
      expect(result.metadata.title).toBe("Omniscient Reader's Viewpoint")
    })

    it('deve lançar ScrapingNetworkError quando a requisição falhar', async () => {
      mockGet.mockRejectedValueOnce(new Error('Network error'))

      await expect(provider.inspect('https://flamecomics.xyz/series/2')).rejects.toThrow(
        ScrapingNetworkError,
      )
    })
  })

  // ─── getChapterImages ──────────────────────────────────────────────────

  describe('getChapterImages', () => {
    it('deve lançar ScrapingParseError se URL do capítulo não for suportada', async () => {
      await expect(provider.getChapterImages('https://invalid.com/series/2/abc')).rejects.toThrow(
        ScrapingParseError,
      )
    })

    it('deve retornar lista de imagens do capítulo', async () => {
      mockGet.mockResolvedValueOnce({
        data: `
          <html>
            <body>
              <script id="__NEXT_DATA__" type="application/json">
                {
                  "props": {
                    "pageProps": {
                      "chapter": {
                        "series_id": 2,
                        "token": "tok1",
                        "images": {
                          "0": { "name": "p01.jpg" },
                          "1": { "name": "p02.jpg" }
                        }
                      }
                    }
                  }
                }
              </script>
            </body>
          </html>
        `,
      })

      const images = await provider.getChapterImages(
        'https://flamecomics.xyz/series/2/tok1',
      )

      expect(images).toHaveLength(2)
      expect(images[0]).toBe('https://cdn.flamecomics.xyz/uploads/images/series/2/tok1/p01.jpg')
      expect(images[1]).toBe('https://cdn.flamecomics.xyz/uploads/images/series/2/tok1/p02.jpg')
    })

    it('deve lançar ScrapingParseError se nenhuma imagem for encontrada', async () => {
      mockGet.mockResolvedValueOnce({
        data: '<html><body>Sem imagens</body></html>',
      })

      await expect(
        provider.getChapterImages('https://flamecomics.xyz/series/2/tok1'),
      ).rejects.toThrow(ScrapingParseError)
    })

    it('deve lançar ScrapingNetworkError quando falhar na rede', async () => {
      mockGet.mockRejectedValueOnce(new Error('Timeout'))

      await expect(
        provider.getChapterImages('https://flamecomics.xyz/series/2/tok1'),
      ).rejects.toThrow(ScrapingNetworkError)
    })
  })

  // ─── downloadImage ────────────────────────────────────────────────────

  describe('downloadImage', () => {
    it('deve baixar a imagem e retornar buffer com contentType', async () => {
      const fakeBuffer = Buffer.from('fake image data')
      mockGet.mockResolvedValueOnce({
        data: fakeBuffer,
        headers: {
          'content-type': 'image/jpeg',
        },
      })

      const result = await provider.downloadImage(
        'https://cdn.flamecomics.xyz/uploads/images/series/2/tok1/p01.jpg',
      )

      expect(result.buffer).toBeInstanceOf(Buffer)
      expect(result.contentType).toBe('image/jpeg')
      expect(mockGet).toHaveBeenCalledWith(
        'https://cdn.flamecomics.xyz/uploads/images/series/2/tok1/p01.jpg',
        expect.objectContaining({
          responseType: 'arraybuffer',
          headers: { Referer: 'https://flamecomics.xyz/' },
        }),
      )
    })

    it('deve lançar ScrapingNetworkError se o download falhar', async () => {
      mockGet.mockRejectedValueOnce(new Error('Connection reset'))

      await expect(
        provider.downloadImage('https://cdn.flamecomics.xyz/fail.jpg'),
      ).rejects.toThrow(ScrapingNetworkError)
    })
  })
})
