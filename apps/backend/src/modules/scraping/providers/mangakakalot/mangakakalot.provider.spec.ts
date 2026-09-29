import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AxiosInstance } from 'axios'
import type { RateLimiter } from '../../rate-limit/types'
import { ScrapingNetworkError } from '../../errors/scraping.errors'
import { MangaKakalotStrategy } from './mangakakalot.provider'

describe('MangaKakalot Provider', () => {
  let rateLimiter: RateLimiter
  let mockClient: AxiosInstance
  let provider: MangaKakalotStrategy

  beforeEach(() => {
    rateLimiter = {
      schedule: vi.fn((fn: () => unknown) => fn()),
    } as unknown as RateLimiter

    mockClient = {
      get: vi.fn(),
      post: vi.fn(),
    } as unknown as AxiosInstance

    provider = new MangaKakalotStrategy(rateLimiter, mockClient)
  })

  describe('Identificação e Metadados', () => {
    it('deve ter o slug correto', () => {
      expect(provider.slug).toBe('mangakakalot')
    })

    it('deve ter o nome correto', () => {
      expect(provider.name).toBe('MangaKakalot')
    })

    it('deve usar o engine cheerio', () => {
      expect(provider.engine).toBe('cheerio')
    })

    it('deve retornar ProviderInfo via getInfo()', () => {
      expect(provider.getInfo()).toEqual({
        slug: 'mangakakalot',
        name: 'MangaKakalot',
        engine: 'cheerio',
      })
    })

    it('deve conter os domínios permitidos', () => {
      expect(provider.allowedDomains).toContain('mangakakalot.gg')
      expect(provider.allowedDomains).toContain('www.mangakakalot.gg')
      expect(provider.allowedDomains).toContain('mangakakalot.com')
      expect(provider.allowedDomains).toContain('2xstorage.com')
    })
  })

  describe('supports() e urlPattern', () => {
    it('deve suportar URLs de mangakakalot.gg e espelhos', () => {
      expect(provider.supports('https://www.mangakakalot.gg/manga/naruto')).toBe(true)
      expect(provider.supports('https://mangakakalot.gg/manga/naruto')).toBe(true)
      expect(provider.supports('https://mangakakalot.com/manga/naruto')).toBe(true)
      expect(provider.supports('https://mangakakalot.tv/manga/naruto')).toBe(true)
      expect(provider.supports('https://mangakakalot.to/manga/naruto')).toBe(true)
      expect(provider.supports('https://mangakakalot.org/manga/naruto')).toBe(true)
    })

    it('deve rejeitar outros domínios e URLs inválidas', () => {
      expect(provider.supports('https://mangalivre.net/manga/solo-leveling')).toBe(false)
      expect(provider.supports('https://example.com/projeto/truth/263')).toBe(false)
      expect(provider.supports('invalid-url')).toBe(false)
    })

    it('urlPattern deve validar URLs de obras', () => {
      expect(provider.urlPattern.test('https://www.mangakakalot.gg/manga/naruto')).toBe(true)
      expect(provider.urlPattern.test('https://mangakakalot.com/manga/naruto')).toBe(true)
      expect(provider.urlPattern.test('https://outrosite.com/manga/naruto')).toBe(false)
    })
  })

  describe('search()', () => {
    const mockSearchHtml = `
      <div class="panel_story_list">
        <div class="story_item">
          <a href="/manga/naruto">
            <img src="https://img-r1.2xstorage.com/thumb/naruto.webp" alt="Naruto" />
          </a>
          <div class="story_item_right">
            <h3 class="story_name"><a href="/manga/naruto">Naruto</a></h3>
            <span>Author(s) : Masashi Kishimoto</span>
          </div>
        </div>
      </div>
    `

    it('deve buscar e retornar mangas encontrados', async () => {
      vi.mocked(mockClient.get).mockResolvedValueOnce({ data: mockSearchHtml } as any)

      const results = await provider.search('naruto')
      expect(rateLimiter.schedule).toHaveBeenCalled()
      expect(mockClient.get).toHaveBeenCalledWith(
        expect.stringContaining('/home/search/json?searchword=naruto'),
        expect.anything()
      )
      expect(results).toHaveLength(1)
      expect(results[0].title).toBe('Naruto')
      expect(results[0].url).toBe('https://www.mangakakalot.gg/manga/naruto')
    })

    it('deve respeitar a opção limit', async () => {
      const multiHtml = `
        <div class="panel_story_list">
          <div class="story_item"><h3 class="story_name"><a href="/manga/1">Manga 1</a></h3></div>
          <div class="story_item"><h3 class="story_name"><a href="/manga/2">Manga 2</a></h3></div>
          <div class="story_item"><h3 class="story_name"><a href="/manga/3">Manga 3</a></h3></div>
        </div>
      `
      vi.mocked(mockClient.get).mockResolvedValueOnce({ data: multiHtml } as any)

      const results = await provider.search('query', { limit: 2 })
      expect(results).toHaveLength(2)
    })

    it('deve retornar array vazio se offset > 0', async () => {
      const results = await provider.search('query', { offset: 10 })
      expect(results).toEqual([])
      expect(mockClient.get).not.toHaveBeenCalled()
    })

    it('deve lançar ScrapingNetworkError quando a busca falhar', async () => {
      vi.mocked(mockClient.get).mockRejectedValue(new Error('Network error'))

      await expect(provider.search('naruto')).rejects.toThrow(ScrapingNetworkError)
    })
  })

  describe('inspect() e Paginação de Capítulos', () => {
    const mockMangaHtml = `
      <div class="manga-info-top">
        <div class="manga-info-pic">
          <img src="https://img-r1.2xstorage.com/thumb/naruto.webp" />
        </div>
        <ul class="manga-info-text">
          <li><h1>Naruto</h1></li>
          <li>Author(s) : Masashi Kishimoto</li>
          <li>Status : Completed</li>
          <li>Genres : <a href="/genre/action">Action</a></li>
        </ul>
      </div>
      <div id="noidungm">
        <h2>Naruto summary:</h2>
        Naruto Uzumaki is a ninja.
      </div>
      <div class="chapter-list">
        <div class="row">
          <span><a href="/manga/naruto/chapter-1">Chapter 1</a></span>
        </div>
      </div>
    `

    it('deve extrair detalhes e paginar 100% dos capítulos via API', async () => {
      // 1. Resposta da página HTML
      vi.mocked(mockClient.get).mockResolvedValueOnce({ data: mockMangaHtml } as any)

      // 2. Página 1 de capítulos via API (has_more = true)
      vi.mocked(mockClient.get).mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            chapters: [
              { chapter_name: 'Chapter 2', chapter_slug: 'chapter-2', chapter_num: 2 },
            ],
            pagination: { total: 2, limit: 1, offset: 0, has_more: true },
          },
        },
      } as any)

      // 3. Página 2 de capítulos via API (has_more = false)
      vi.mocked(mockClient.get).mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            chapters: [
              { chapter_name: 'Chapter 1', chapter_slug: 'chapter-1', chapter_num: 1 },
            ],
            pagination: { total: 2, limit: 1, offset: 1, has_more: false },
          },
        },
      } as any)

      const result = await provider.inspect('https://www.mangakakalot.gg/manga/naruto')
      expect(result.metadata.title).toBe('Naruto')
      expect(result.metadata.status).toBe('completed')
      expect(result.chapters).toHaveLength(2)
      expect(result.chapters[0].number).toBe('1')
      expect(result.chapters[1].number).toBe('2')
      expect(result.statistics.chapters).toBe(2)
    })

    it('deve usar capítulos do HTML se a API falhar', async () => {
      // 1. Resposta da página HTML com 1 capítulo
      vi.mocked(mockClient.get).mockResolvedValueOnce({ data: mockMangaHtml } as any)
      // 2. Falha na chamada da API de capítulos
      vi.mocked(mockClient.get).mockRejectedValueOnce(new Error('API offline'))

      const result = await provider.inspect('https://www.mangakakalot.gg/manga/naruto')
      expect(result.metadata.title).toBe('Naruto')
      expect(result.chapters).toHaveLength(1)
      expect(result.chapters[0].number).toBe('1')
    })

    it('deve lançar ScrapingNetworkError se a página HTML falhar sem slug', async () => {
      vi.mocked(mockClient.get).mockRejectedValue(new Error('Network error'))

      await expect(provider.inspect('https://www.mangakakalot.gg/invalid')).rejects.toThrow(
        ScrapingNetworkError
      )
    })
  })

  describe('getChapterImages()', () => {
    it('deve retornar URLs de imagens do leitor', async () => {
      const mockReaderHtml = `
        <div class="container-chapter-reader">
          <img src="https://imgs-2.2xstorage.com/naruto/1/0.webp" />
          <img src="https://imgs-2.2xstorage.com/naruto/1/1.webp" />
        </div>
      `
      vi.mocked(mockClient.get).mockResolvedValueOnce({ data: mockReaderHtml } as any)

      const images = await provider.getChapterImages('https://www.mangakakalot.gg/manga/naruto/chapter-1')
      expect(images).toHaveLength(2)
      expect(images[0]).toBe('https://imgs-2.2xstorage.com/naruto/1/0.webp')
      expect(images[1]).toBe('https://imgs-2.2xstorage.com/naruto/1/1.webp')
    })

    it('deve lançar ScrapingNetworkError quando a requisição falhar', async () => {
      vi.mocked(mockClient.get).mockRejectedValue(new Error('Network error'))

      await expect(
        provider.getChapterImages('https://www.mangakakalot.gg/manga/naruto/chapter-1')
      ).rejects.toThrow(ScrapingNetworkError)
    })
  })

  describe('downloadImage()', () => {
    it('deve baixar imagem como buffer', async () => {
      const mockBuffer = Buffer.from('fake-image-data')
      vi.mocked(mockClient.get).mockResolvedValueOnce({
        data: mockBuffer,
        headers: { 'content-type': 'image/webp' },
      } as any)

      const result = await provider.downloadImage('https://imgs-2.2xstorage.com/naruto/1/0.webp')
      expect(result.buffer).toBeInstanceOf(Buffer)
      expect(result.contentType).toBe('image/webp')
    })

    it('deve lançar ScrapingNetworkError quando o download falhar', async () => {
      vi.mocked(mockClient.get).mockRejectedValue(new Error('Download failed'))

      await expect(
        provider.downloadImage('https://imgs-2.2xstorage.com/naruto/1/0.webp')
      ).rejects.toThrow(ScrapingNetworkError)
    })
  })
})
