import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AxiosInstance } from 'axios'
import type { RateLimiter } from '../../rate-limit/types'
import {
  ScrapingNetworkError,
  SourceNotFoundError,
  InvalidUrlError,
  ScrapingParseError,
} from '../../errors/scraping.errors'
import { MangaFireStrategy } from './mangafire.provider'
import {
  extractMangaId,
  extractChapterId,
  normalizeStatus,
  stripHtml,
  parseSearchResults,
  mapToChapter,
  mapToSourceInspectResponse,
  mapToPages,
} from './mangafire.mapper'

vi.mock('./mangafire.vrf', () => ({
  initMangaFireSigner: vi.fn().mockResolvedValue(undefined),
  getVrfToken: vi.fn().mockResolvedValue('mock-vrf-token'),
}))

describe('MangaFire Provider', () => {
  let rateLimiter: RateLimiter
  let mockClient: AxiosInstance
  let provider: MangaFireStrategy

  beforeEach(() => {
    rateLimiter = {
      schedule: vi.fn((fn: () => unknown) => fn()),
    } as unknown as RateLimiter

    mockClient = {
      get: vi.fn(),
      post: vi.fn(),
    } as unknown as AxiosInstance

    provider = new MangaFireStrategy(rateLimiter, mockClient)
  })

  describe('Identificação e Metadados', () => {
    it('deve ter o slug correto', () => {
      expect(provider.slug).toBe('mangafire')
    })

    it('deve ter o nome correto', () => {
      expect(provider.name).toBe('MangaFire')
    })

    it('deve usar o engine api', () => {
      expect(provider.engine).toBe('api')
    })

    it('deve retornar ProviderInfo via getInfo()', () => {
      expect(provider.getInfo()).toEqual({
        slug: 'mangafire',
        name: 'MangaFire',
        engine: 'api',
      })
    })

    it('deve conter os domínios permitidos', () => {
      expect(provider.allowedDomains).toContain('mangafire.to')
      expect(provider.allowedDomains).toContain('www.mangafire.to')
      expect(provider.allowedDomains).toContain('mangafire.sx')
      expect(provider.allowedDomains).toContain('www.mangafire.sx')
      expect(provider.allowedDomains).toContain('mangafire.is')
      expect(provider.allowedDomains).toContain('s.mfcdn.nl')
    })
  })

  describe('supports() e urlPattern', () => {
    it('deve suportar URLs de mangafire.to, mangafire.sx e mangafire.is', () => {
      expect(provider.supports('https://mangafire.to/title/dkw-one-piece')).toBe(true)
      expect(provider.supports('https://www.mangafire.to/title/dkw')).toBe(true)
      expect(provider.supports('https://mangafire.sx/manga/one-piece.dkw')).toBe(true)
      expect(provider.supports('https://mangafire.is/title/92kk8-naruto')).toBe(true)
    })

    it('deve rejeitar outros domínios e URLs inválidas', () => {
      expect(provider.supports('https://mangalivre.net/manga/solo-leveling')).toBe(false)
      expect(provider.supports('https://example.com/projeto/truth/263')).toBe(false)
      expect(provider.supports('not-a-valid-url')).toBe(false)
    })

    it('urlPattern deve validar URLs de obras', () => {
      expect(provider.urlPattern.test('https://mangafire.to/title/dkw-one-piece')).toBe(true)
      expect(provider.urlPattern.test('https://mangafire.sx/title/dkw')).toBe(true)
      expect(provider.urlPattern.test('https://outrosite.com/title/dkw')).toBe(false)
    })
  })

  describe('Mapper Functions', () => {
    describe('extractMangaId', () => {
      it('deve extrair o HID de URLs de títulos', () => {
        expect(extractMangaId('https://mangafire.to/title/dkw-one-piece')).toBe('dkw')
        expect(extractMangaId('https://mangafire.to/title/dkw')).toBe('dkw')
        expect(extractMangaId('https://mangafire.to/title/92kk8-naruto')).toBe('92kk8')
      })

      it('deve extrair o HID de URLs no formato /manga/', () => {
        expect(extractMangaId('https://mangafire.to/manga/one-piece.dkw')).toBe('dkw')
        expect(extractMangaId('https://mangafire.to/manga/dkw')).toBe('dkw')
      })

      it('deve extrair o HID quando fornecido diretamente', () => {
        expect(extractMangaId('dkw')).toBe('dkw')
        expect(extractMangaId('92kk8')).toBe('92kk8')
      })
    })

    describe('extractChapterId', () => {
      it('deve extrair o ID do capítulo de URLs', () => {
        expect(
          extractChapterId('https://mangafire.to/title/dkw-one-piece/chapter/9455278')
        ).toBe('9455278')
        expect(
          extractChapterId('https://mangafire.to/read/one-piece.dkw/en/chapter-9455278')
        ).toBe('9455278')
        expect(extractChapterId('9455278')).toBe('9455278')
      })
    })

    describe('normalizeStatus', () => {
      it('deve normalizar os status do MangaFire', () => {
        expect(normalizeStatus('releasing')).toBe('ongoing')
        expect(normalizeStatus('ongoing')).toBe('ongoing')
        expect(normalizeStatus('completed')).toBe('completed')
        expect(normalizeStatus('finished')).toBe('completed')
        expect(normalizeStatus('hiatus')).toBe('hiatus')
        expect(normalizeStatus('discontinued')).toBe('cancelled')
        expect(normalizeStatus('cancelled')).toBe('cancelled')
        expect(normalizeStatus(undefined)).toBe('unknown')
        expect(normalizeStatus(null)).toBe('unknown')
        expect(normalizeStatus('other')).toBe('unknown')
      })
    })

    describe('stripHtml', () => {
      it('deve limpar tags HTML e converter quebras de linha', () => {
        const raw = '<p>Sinopse do mangá.<br>Segunda linha.</p>'
        expect(stripHtml(raw)).toBe('Sinopse do mangá.\nSegunda linha.')
      })

      it('deve decodificar entidades HTML comuns', () => {
        const raw = 'Gol D. &quot;Pirate King&quot; Roger &amp; crew'
        expect(stripHtml(raw)).toBe('Gol D. "Pirate King" Roger & crew')
      })

      it('deve retornar null para texto vazio', () => {
        expect(stripHtml('')).toBeNull()
        expect(stripHtml(null)).toBeNull()
        expect(stripHtml(undefined)).toBeNull()
      })
    })

    describe('parseSearchResults', () => {
      it('deve mapear a resposta de busca corretamente', () => {
        const mockSearchResponse = {
          total: 1,
          items: [
            {
              id: 1,
              hid: 'dkw',
              slug: 'one-piece',
              title: 'One Piece',
              poster: {
                large: 'https://static.mfcdn.nl/poster/dkw-large.jpg',
              },
              type: 'manga',
              genres: ['Action', 'Adventure'],
              authors: ['Eiichiro Oda'],
            },
          ],
        }

        const results = parseSearchResults(mockSearchResponse, 'https://mangafire.to')
        expect(results).toHaveLength(1)
        expect(results[0]).toEqual({
          providerSlug: 'mangafire',
          title: 'One Piece',
          url: 'https://mangafire.to/title/dkw-one-piece',
          coverUrl: 'https://static.mfcdn.nl/poster/dkw-large.jpg',
          author: 'Eiichiro Oda',
          type: 'manga',
          genres: ['Action', 'Adventure'],
        })
      })

      it('deve retornar array vazio se a resposta for nula ou sem itens', () => {
        expect(parseSearchResults({ total: 0 } as any)).toEqual([])
        expect(parseSearchResults(null as any)).toEqual([])
      })
    })

    describe('mapToChapter', () => {
      it('deve mapear um item de capítulo', () => {
        const chapterItem = {
          id: 9455278,
          number: 1194,
          name: 'The King of Pirates',
          language: 'en',
          type: 'official',
          volume: 108,
          createdAt: 1711670400,
        }

        const chapter = mapToChapter(chapterItem, 'dkw', 'one-piece', 'https://mangafire.to')
        expect(chapter).toEqual({
          id: 'chap_1194',
          number: '1194',
          title: 'The King of Pirates',
          url: 'https://mangafire.to/title/dkw-one-piece/chapter/9455278',
          pages: null,
          volume: 108,
          isDownloaded: false,
          isRead: false,
        })
      })
    })

    describe('mapToSourceInspectResponse', () => {
      it('deve mapear detalhes e capítulos da obra', () => {
        const detail = {
          id: 1,
          hid: 'dkw',
          slug: 'one-piece',
          title: 'One Piece',
          synopsisHtml: '<p>Luffy sets sail to find One Piece.</p>',
          status: 'releasing',
          poster: {
            large: 'https://static.mfcdn.nl/poster/dkw.jpg',
          },
          authors: ['Eiichiro Oda'],
          genres: ['Action', 'Adventure'],
        }

        const chapters = [
          { id: 2, number: 2, name: '', language: 'en' },
          { id: 1, number: 1, name: 'Romance Dawn', language: 'en' },
        ]

        const inspect = mapToSourceInspectResponse(
          detail,
          chapters,
          'https://mangafire.to/title/dkw-one-piece',
          'https://mangafire.to',
          provider.getInfo()
        )

        expect(inspect.sourceId).toMatch(/^src-dkw-one-piece-/)
        expect(inspect.status).toBe('ready')
        expect(inspect.metadata.title).toBe('One Piece')
        expect(inspect.metadata.author).toBe('Eiichiro Oda')
        expect(inspect.metadata.status).toBe('ongoing')
        expect(inspect.metadata.genres).toEqual(['Action', 'Adventure'])
        expect(inspect.metadata.description).toBe('Luffy sets sail to find One Piece.')
        expect(inspect.covers).toHaveLength(1)
        expect(inspect.covers[0].imageUrl).toBe('https://static.mfcdn.nl/poster/dkw.jpg')
        expect(inspect.chapters).toHaveLength(2)
        // Deve vir ordenado crescentemente pelo número do capítulo
        expect(inspect.chapters[0].number).toBe('1')
        expect(inspect.chapters[1].number).toBe('2')
        expect(inspect.statistics).toEqual({
          chapters: 2,
          covers: 1,
        })
      })
    })

    describe('mapToPages', () => {
      it('deve extrair páginas de data.pages', () => {
        const response = {
          status: 200,
          result: 'success',
          data: {
            pages: [
              { url: 'https://static.mfcdn.nl/page1.jpg', offset: 0 },
              { url: 'https://static.mfcdn.nl/page2.jpg', offset: 1 },
            ],
          },
        }

        expect(mapToPages(response)).toEqual([
          'https://static.mfcdn.nl/page1.jpg',
          'https://static.mfcdn.nl/page2.jpg',
        ])
      })

      it('deve extrair páginas de images array', () => {
        const response = {
          images: [
            { url: 'https://static.mfcdn.nl/p1.jpg' },
            'https://static.mfcdn.nl/p2.jpg',
          ],
        }

        expect(mapToPages(response)).toEqual([
          'https://static.mfcdn.nl/p1.jpg',
          'https://static.mfcdn.nl/p2.jpg',
        ])
      })

      it('deve retornar array vazio se não houver páginas', () => {
        expect(mapToPages({} as any)).toEqual([])
      })
    })
  })

  describe('Métodos de Estratégia do Provider', () => {
    describe('search()', () => {
      it('deve retornar obras encontradas', async () => {
        const mockResponse = {
          data: {
            total: 1,
            items: [
              {
                id: 1,
                hid: 'dkw',
                slug: 'one-piece',
                title: 'One Piece',
                poster: { large: 'https://cover.jpg' },
              },
            ],
          },
        }
        ;(mockClient.get as any).mockResolvedValueOnce(mockResponse)

        const results = await provider.search('one piece')
        expect(results).toHaveLength(1)
        expect(results[0].title).toBe('One Piece')
        expect(results[0].url).toBe('https://mangafire.to/title/dkw-one-piece')
      })

      it('deve retornar array vazio para query vazia ou offset > 0', async () => {
        expect(await provider.search('')).toEqual([])
        expect(await provider.search('   ')).toEqual([])
        expect(await provider.search('one piece', { offset: 10 })).toEqual([])
      })

      it('deve lançar ScrapingNetworkError quando ocorrer falha de rede', async () => {
        ;(mockClient.get as any).mockRejectedValueOnce(new Error('Network error'))
        await expect(provider.search('one piece')).rejects.toThrow(ScrapingNetworkError)
      })
    })

    describe('inspect()', () => {
      it('deve lançar InvalidUrlError para URL inválida', async () => {
        await expect(provider.inspect('https://outrosite.com/obra')).rejects.toThrow(
          InvalidUrlError
        )
      })

      it('deve coletar obra e paginar todos os capítulos', async () => {
        const titleResponse = {
          data: {
            data: {
              id: 1,
              hid: 'dkw',
              slug: 'one-piece',
              title: 'One Piece',
              status: 'releasing',
              poster: { large: 'https://cover.jpg' },
            },
          },
        }

        // Simula página 1 de capítulos (com hasNext: true)
        const chPage1Response = {
          data: {
            meta: {
              total: 2,
              perPage: 1,
              page: 1,
              lastPage: 2,
              hasNext: true,
              hasPrev: false,
            },
            items: [{ id: 1, number: 1, name: 'Capítulo 1' }],
          },
        }

        // Simula página 2 de capítulos (com hasNext: false)
        const chPage2Response = {
          data: {
            meta: {
              total: 2,
              perPage: 1,
              page: 2,
              lastPage: 2,
              hasNext: false,
              hasPrev: true,
            },
            items: [{ id: 2, number: 2, name: 'Capítulo 2' }],
          },
        }

        ;(mockClient.get as any)
          .mockResolvedValueOnce(titleResponse)
          .mockResolvedValueOnce(chPage1Response)
          .mockResolvedValueOnce(chPage2Response)

        const result = await provider.inspect('https://mangafire.to/title/dkw-one-piece')
        expect(result.metadata.title).toBe('One Piece')
        // Deve conter os 2 capítulos coletados pelas 2 páginas
        expect(result.chapters).toHaveLength(2)
        expect(result.chapters[0].number).toBe('1')
        expect(result.chapters[1].number).toBe('2')
      })

      it('deve lançar SourceNotFoundError se a obra retornar 404', async () => {
        ;(mockClient.get as any).mockRejectedValueOnce({
          response: { status: 404 },
          message: 'Not found',
        })

        await expect(
          provider.inspect('https://mangafire.to/title/inexistente')
        ).rejects.toThrow(SourceNotFoundError)
      })
    })

    describe('getChapterImages()', () => {
      it('deve retornar URLs de imagens do capítulo', async () => {
        const mockResponse = {
          data: {
            status: 200,
            result: 'success',
            data: {
              pages: [
                { url: 'https://static.mfcdn.nl/1.jpg' },
                { url: 'https://static.mfcdn.nl/2.jpg' },
              ],
            },
          },
        }
        ;(mockClient.get as any).mockResolvedValueOnce(mockResponse)

        const pages = await provider.getChapterImages(
          'https://mangafire.to/title/dkw-one-piece/chapter/9455278'
        )
        expect(pages).toEqual([
          'https://static.mfcdn.nl/1.jpg',
          'https://static.mfcdn.nl/2.jpg',
        ])
      })

      it('deve lançar InvalidUrlError para URL de capítulo vazia', async () => {
        await expect(provider.getChapterImages('')).rejects.toThrow(InvalidUrlError)
      })

      it('deve lançar ScrapingParseError quando não houver páginas', async () => {
        ;(mockClient.get as any).mockResolvedValueOnce({
          data: { status: 200, data: { pages: [] } },
        })

        await expect(
          provider.getChapterImages(
            'https://mangafire.to/title/dkw-one-piece/chapter/9455278'
          )
        ).rejects.toThrow(ScrapingParseError)
      })

      it('deve lançar SourceNotFoundError quando o capítulo retornar 404', async () => {
        ;(mockClient.get as any).mockRejectedValueOnce({
          response: { status: 404 },
          message: 'Not found',
        })

        await expect(
          provider.getChapterImages(
            'https://mangafire.to/title/dkw-one-piece/chapter/9455278'
          )
        ).rejects.toThrow(SourceNotFoundError)
      })
    })

    describe('downloadImage()', () => {
      it('deve baixar imagem e retornar buffer e contentType', async () => {
        const imageBuffer = Buffer.from('fake-image-bytes')
        ;(mockClient.get as any).mockResolvedValueOnce({
          data: imageBuffer,
          headers: { 'content-type': 'image/webp' },
        })

        const result = await provider.downloadImage('https://static.mfcdn.nl/img.webp')
        expect(result.buffer).toBeInstanceOf(Buffer)
        expect(result.contentType).toBe('image/webp')
      })

      it('deve lançar ScrapingNetworkError se o download falhar', async () => {
        ;(mockClient.get as any).mockRejectedValueOnce(new Error('Download failed'))
        await expect(
          provider.downloadImage('https://static.mfcdn.nl/img.webp')
        ).rejects.toThrow(ScrapingNetworkError)
      })
    })
  })
})
