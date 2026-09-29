import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ScrapingNetworkError, ScrapingParseError } from '../../errors/scraping.errors'
import type { RateLimiter } from '../../rate-limit/types'

const mockGet = vi.hoisted(() => vi.fn())
const mockPost = vi.hoisted(() => vi.fn())

vi.mock('../../../../shared/http/http-client', () => ({
  createHttpClient: vi.fn(() => ({
    get: mockGet,
    post: mockPost,
  })),
}))

import { TaiyoStrategy } from './taiyo.provider'

describe('TaiyoStrategy', () => {
  let strategy: TaiyoStrategy
  let mockRateLimiter: RateLimiter

  beforeEach(() => {
    vi.clearAllMocks()

    mockRateLimiter = {
      schedule: vi.fn((fn: any) => fn()),
    } as unknown as RateLimiter

    strategy = new TaiyoStrategy(mockRateLimiter)
  })

  describe('supports', () => {
    it('deve aceitar URLs válidas do Taiyo', () => {
      expect(strategy.supports('https://taiyo.moe/media/feebe69d-fc00-4c2c-aae0-cb0ef872c40c')).toBe(true)
      expect(strategy.supports('https://taiyo.moe/media/123-abc')).toBe(true)
    })

    it('deve rejeitar domínios ou caminhos diferentes', () => {
      expect(strategy.supports('https://mangalivre.to/manga/solo')).toBe(false)
      expect(strategy.supports('https://taiyo.moe/search')).toBe(false)
      expect(strategy.supports('invalid-url')).toBe(false)
    })
  })

  describe('getInfo', () => {
    it('deve retornar metadados do provider Taiyo', () => {
      const info = strategy.getInfo()
      expect(info.slug).toBe('taiyo')
      expect(info.name).toBe('Taiyo')
      expect(info.engine).toBe('api')
    })
  })

  describe('search', () => {
    it('deve buscar no Meilisearch e retornar resultados formatados', async () => {
      mockPost.mockResolvedValueOnce({
        data: {
          hits: [
            {
              id: 'media-1',
              titles: [{ title: 'Solo Leveling', language: 'PT-BR' }],
              mainCoverId: 'cover-1',
            },
          ],
        },
      })

      const results = await strategy.search('Solo', { limit: 5 })

      expect(mockRateLimiter.schedule).toHaveBeenCalled()
      expect(mockPost).toHaveBeenCalledWith(
        expect.stringContaining('/indexes/medias/search'),
        { q: 'Solo', limit: 5 },
        expect.any(Object),
      )
      expect(results).toHaveLength(1)
      expect(results[0].title).toBe('Solo Leveling')
      expect(results[0].providerSlug).toBe('taiyo')
      expect(results[0].url).toBe('https://taiyo.moe/media/media-1')
    })

    it('deve retornar vazio se offset > 0', async () => {
      const results = await strategy.search('Solo', { offset: 10 })
      expect(results).toEqual([])
      expect(mockPost).not.toHaveBeenCalled()
    })

    it('deve lançar ScrapingNetworkError se a busca falhar', async () => {
      mockPost.mockRejectedValueOnce(new Error('Meilisearch unavailable'))
      await expect(strategy.search('Solo')).rejects.toThrow(ScrapingNetworkError)
    })
  })

  describe('inspect com paginação de capítulos', () => {
    it('deve iterar por todas as páginas de capítulos até totalPages', async () => {
      const mediaId = 'feebe69d-fc00-4c2c-aae0-cb0ef872c40c'
      const canonicalUrl = `https://taiyo.moe/media/${mediaId}`

      // 1ª chamada: media.getById
      mockGet.mockResolvedValueOnce({
        data: [
          {
            result: {
              data: {
                json: {
                  id: mediaId,
                  titles: [{ title: 'Obra Completa', language: 'PT-BR' }],
                  synopsis: 'Sinopse longa',
                  genres: ['Action', 'Fantasy'],
                  status: 'RELEASING',
                },
              },
            },
          },
        ],
      })

      // 2ª chamada: chapters.getByMediaId - página 1 (de 2 páginas) com 100 capítulos
      const page1Chapters = Array.from({ length: 100 }, (_, i) => ({
        id: `ch-${i + 1}`,
        number: i + 1,
        title: `Capítulo ${i + 1}`,
      }))

      mockGet.mockResolvedValueOnce({
        data: [
          {
            result: {
              data: {
                json: {
                  chapters: page1Chapters,
                  totalPages: 2,
                  totalChapters: 150,
                },
              },
            },
          },
        ],
      })

      // 3ª chamada: chapters.getByMediaId - página 2 (de 2 páginas) com 50 capítulos
      const page2Chapters = Array.from({ length: 50 }, (_, i) => ({
        id: `ch-${i + 101}`,
        number: i + 101,
        title: `Capítulo ${i + 101}`,
      }))

      mockGet.mockResolvedValueOnce({
        data: [
          {
            result: {
              data: {
                json: {
                  chapters: page2Chapters,
                  totalPages: 2,
                  totalChapters: 150,
                },
              },
            },
          },
        ],
      })

      const inspected = await strategy.inspect(canonicalUrl)

      // Verificações
      expect(mockGet).toHaveBeenCalledTimes(3)
      expect(inspected.metadata.title).toBe('Obra Completa')
      expect(inspected.chapters).toHaveLength(150)
      expect(inspected.chapters[0].number).toBe('1')
      expect(inspected.chapters[149].number).toBe('150')
    })

    it('deve lançar ScrapingParseError se mediaId não puder ser extraído', async () => {
      await expect(strategy.inspect('https://taiyo.moe/invalid/path')).rejects.toThrow(ScrapingParseError)
    })

    it('deve lançar ScrapingNetworkError se falhar na rede', async () => {
      mockGet.mockRejectedValueOnce(new Error('Network error'))
      await expect(strategy.inspect('https://taiyo.moe/media/123-abc')).rejects.toThrow(ScrapingNetworkError)
    })
  })

  describe('getChapterImages', () => {
    it('deve extrair páginas do capítulo corretamente', async () => {
      mockGet.mockResolvedValueOnce({
        data: [
          {
            result: {
              data: {
                json: {
                  id: 'ch-1',
                  mediaId: 'media-1',
                  pages: [
                    { id: 'img-1', extension: 'jpg', pageNumber: 1 },
                    { id: 'img-2', extension: 'png', pageNumber: 2 },
                  ],
                },
              },
            },
          },
        ],
      })

      const pages = await strategy.getChapterImages('https://taiyo.moe/chapter/ch-1')
      expect(pages).toHaveLength(2)
      expect(pages[0]).toBe('https://cdn.taiyo.moe/medias/media-1/chapters/ch-1/img-1.jpg')
      expect(pages[1]).toBe('https://cdn.taiyo.moe/medias/media-1/chapters/ch-1/img-2.png')
    })

    it('deve lançar ScrapingParseError se chapterId for inválido', async () => {
      await expect(strategy.getChapterImages('https://taiyo.moe/other/123')).rejects.toThrow(ScrapingParseError)
    })
  })

  describe('downloadImage', () => {
    it('deve baixar imagem como buffer com content-type detectado', async () => {
      const buffer = Buffer.from('fake-image-bytes')
      mockGet.mockResolvedValueOnce({
        data: buffer,
        headers: { 'content-type': 'image/jpeg' },
      })

      const result = await strategy.downloadImage('https://cdn.taiyo.moe/medias/1/chapters/1/1.jpg')
      expect(result.buffer).toBeInstanceOf(Buffer)
      expect(result.contentType).toBe('image/jpeg')
    })

    it('deve lançar ScrapingNetworkError se falhar no download', async () => {
      mockGet.mockRejectedValueOnce(new Error('Download failed'))
      await expect(strategy.downloadImage('https://cdn.taiyo.moe/medias/1/chapters/1/1.jpg')).rejects.toThrow(
        ScrapingNetworkError,
      )
    })
  })
})
