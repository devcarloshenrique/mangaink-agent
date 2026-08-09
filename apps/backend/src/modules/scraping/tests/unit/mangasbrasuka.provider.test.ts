import { describe, expect, it, vi, beforeEach } from 'vitest'
import { MangasBrasukaStrategy } from '../../providers/mangasbrasuka/mangasbrasuka.provider'
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

describe('MangasBrasukaStrategy', () => {
  let provider: MangasBrasukaStrategy

  beforeEach(() => {
    vi.clearAllMocks()
    provider = new MangasBrasukaStrategy(fakeLimiter)
  })

  // ─── Propriedades ───────────────────────────────────────────────────────

  describe('Propriedades', () => {
    it('deve ter slug "mangasbrasuka"', () => {
      expect(provider.slug).toBe('mangasbrasuka')
    })

    it('deve ter name "Mangas Brasukas"', () => {
      expect(provider.name).toBe('Mangas Brasukas')
    })

    it('deve ter engine "api"', () => {
      expect(provider.engine).toBe('api')
    })

    it('deve ter allowedDomains com 3 domínios', () => {
      expect(provider.allowedDomains).toEqual([
        'mangasbrasuka.com.br',
        'app.mangasbrasuka.com.br',
        'cdn.mugiverso.com',
      ])
    })

    it('deve ter urlPattern que matcha URLs do Mangas Brasukas', () => {
      expect(provider.urlPattern.test('https://mangasbrasuka.com.br/manga/test/')).toBe(true)
      expect(provider.urlPattern.test('https://example.com/manga/test/')).toBe(false)
    })
  })

  // ─── supports ──────────────────────────────────────────────────────────

  describe('supports', () => {
    it('deve retornar true para URL do mangasbrasuka.com.br', () => {
      expect(provider.supports('https://mangasbrasuka.com.br/manga/meu-manga/')).toBe(true)
    })

    it('deve retornar true para URL sem barra final', () => {
      expect(provider.supports('https://mangasbrasuka.com.br/manga/test')).toBe(true)
    })

    it('deve retornar false para URL de outro domínio', () => {
      expect(provider.supports('https://example.com/manga/test/')).toBe(false)
    })

    it('deve retornar false para URL malformada', () => {
      expect(provider.supports('not-a-url')).toBe(false)
    })
  })

  // ─── getInfo ───────────────────────────────────────────────────────────

  describe('getInfo', () => {
    it('deve retornar ProviderInfo correto', () => {
      const info = provider.getInfo()
      expect(info.slug).toBe('mangasbrasuka')
      expect(info.name).toBe('Mangas Brasukas')
      expect(info.engine).toBe('api')
    })
  })

  // ─── inspect ───────────────────────────────────────────────────────────

  describe('inspect', () => {
    const fakeObraResponse = {
      data: {
        data: {
          id: 'wrk_1',
          slug: 'manga-de-teste',
          title: 'Manga de Teste',
          altTitles: [],
          author: 'Autor Teste',
          publisher: null,
          coverUrl: 'https://cdn.mugiverso.com/cover.webp',
          backgroundUrl: null,
          description: 'Descrição teste',
          descriptionEn: '',
          tags: ['Ação'],
          type: 'manga',
          status: 'published',
          publicationStatus: 'ongoing',
          chapterCount: 1,
          isAdult: false,
          availabilitySummary: {
            hasFreeChapters: true,
            hasPremiumChapters: false,
          },
        },
      },
    }

    const fakeChaptersResponse = {
      data: {
        data: [
          {
            id: 'chp_1',
            number: 1,
            title: 'Capítulo 1',
            publishedAt: null,
            access: 'free',
            isFree: true,
            isPremium: false,
            isLocked: false,
            kind: 'chapter',
            isPreview: false,
          },
        ],
      },
    }

    it('deve retornar SourceInspectResponse no sucesso', async () => {
      mockGet.mockResolvedValueOnce(fakeObraResponse)
      mockGet.mockResolvedValueOnce(fakeChaptersResponse)

      const result = await provider.inspect('https://mangasbrasuka.com.br/manga/manga-de-teste/')

      expect(result).toHaveProperty('sourceId')
      expect(result).toHaveProperty('status', 'ready')
      expect(result).toHaveProperty('provider')
      expect(result).toHaveProperty('source')
      expect(result).toHaveProperty('metadata')
      expect(result).toHaveProperty('chapters')
      expect(result).toHaveProperty('covers')
      expect(result).toHaveProperty('statistics')
      expect(result.metadata.title).toBe('Manga de Teste')
      expect(result.chapters).toHaveLength(1)
    })

    it('deve lançar ScrapingNetworkError quando HTTP falha', async () => {
      mockGet.mockRejectedValue(new Error('ECONNREFUSED'))

      await expect(provider.inspect('https://mangasbrasuka.com.br/manga/test/')).rejects.toThrow(
        ScrapingNetworkError,
      )
    })

    it('deve lançar erro para URL sem slug', async () => {
      await expect(provider.inspect('https://mangasbrasuka.com.br/')).rejects.toThrow()
    })
  })

  // ─── getChapterImages ──────────────────────────────────────────────────

  describe('getChapterImages', () => {
    it('deve retornar lista de URLs de imagens no sucesso', async () => {
      mockGet.mockResolvedValueOnce({
        data: {
          data: {
            chapterId: '1',
            pages: [
              {
                index: 1,
                imageUrl: 'https://cdn.mugiverso.com/p1.webp',
                width: 0,
                height: 0,
                isDouble: false,
              },
              {
                index: 2,
                imageUrl: 'https://cdn.mugiverso.com/p2.webp',
                width: 0,
                height: 0,
                isDouble: false,
              },
            ],
          },
        },
      })

      const images = await provider.getChapterImages(
        'https://mangasbrasuka.com.br/manga/manga-de-teste/1',
      )

      expect(images).toEqual([
        'https://cdn.mugiverso.com/p1.webp',
        'https://cdn.mugiverso.com/p2.webp',
      ])
    })

    it('deve lançar ScrapingNetworkError quando HTTP falha', async () => {
      mockGet.mockRejectedValue(new Error('Network Error'))

      await expect(
        provider.getChapterImages('https://mangasbrasuka.com.br/manga/test/1'),
      ).rejects.toThrow(ScrapingNetworkError)
    })

    it('deve lançar erro para URL de capítulo inválida', async () => {
      await expect(provider.getChapterImages('https://example.com/invalid-url')).rejects.toThrow()
    })
  })

  // ─── downloadImage ─────────────────────────────────────────────────────

  describe('downloadImage', () => {
    it('deve retornar buffer e contentType no sucesso', async () => {
      const fakeBuffer = Buffer.from('fake-image-data')
      mockGet.mockResolvedValue({
        data: fakeBuffer,
        headers: { 'content-type': 'image/webp' },
      })

      const result = await provider.downloadImage('https://cdn.mugiverso.com/test.webp')

      expect(result.buffer).toBeInstanceOf(Buffer)
      expect(result.contentType).toBe('image/webp')
    })

    it('deve lançar ScrapingNetworkError quando HTTP falha', async () => {
      mockGet.mockRejectedValue(new Error('Download failed'))

      await expect(provider.downloadImage('https://cdn.mugiverso.com/test.webp')).rejects.toThrow(
        ScrapingNetworkError,
      )
    })
  })
})
