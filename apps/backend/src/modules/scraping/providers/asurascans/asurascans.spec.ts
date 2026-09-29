import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AsuraScansStrategy, AsuraScansProvider } from './asurascans.provider'
import {
  normalizeStatus,
  extractChapterNumber,
  toAbsoluteUrl,
  parseSearchResults,
  mapComicDetails,
  parseChapterImages,
} from './asurascans.mapper'
import { ScrapingNetworkError, ScrapingParseError } from '../../errors/scraping.errors'

const mockRateLimiter = {
  schedule: vi.fn().mockImplementation((fn: () => unknown) => fn()),
  counts: vi.fn().mockReturnValue({ running: 0, queued: 0 }),
  stop: vi.fn().mockResolvedValue(undefined),
} as any

describe('AsuraScansStrategy', () => {
  let strategy: AsuraScansStrategy
  let mockHttpClient: {
    get: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    vi.clearAllMocks()
    strategy = new AsuraScansStrategy(mockRateLimiter)

    mockHttpClient = {
      get: vi.fn(),
    }
    ;(strategy as any).client = mockHttpClient
  })

  describe('Identificação e Metadados', () => {
    it('deve possuir slug correto', () => {
      expect(strategy.slug).toBe('asurascans')
    })

    it('deve possuir name correto', () => {
      expect(strategy.name).toBe('Asura Scans')
    })

    it('deve possuir engine cheerio', () => {
      expect(strategy.engine).toBe('cheerio')
    })

    it('deve retornar getInfo corretamente', () => {
      const info = strategy.getInfo()
      expect(info.slug).toBe('asurascans')
      expect(info.name).toBe('Asura Scans')
      expect(info.engine).toBe('cheerio')
    })

    it('deve exportar AsuraScansProvider como alias', () => {
      expect(AsuraScansProvider).toBe(AsuraScansStrategy)
    })
  })

  describe('supports', () => {
    it('deve suportar URLs válidas de asurascans.com e asuracomics.com', () => {
      expect(strategy.supports('https://asurascans.com/comics/solo-leveling')).toBe(true)
      expect(strategy.supports('https://www.asurascans.com/comics/solo-leveling/chapter/1')).toBe(true)
      expect(strategy.supports('https://asuracomics.com/comics/myst-might-mayhem-3ec3b16f')).toBe(true)
      expect(strategy.supports('https://asuracomic.net/comics/myst-might-mayhem')).toBe(true)
    })

    it('não deve suportar URLs de outros domínios ou inválidas', () => {
      expect(strategy.supports('https://mangalivre.to/manga/solo-leveling')).toBe(false)
      expect(strategy.supports('https://google.com')).toBe(false)
      expect(strategy.supports('not-a-valid-url')).toBe(false)
    })
  })

  describe('search', () => {
    it('deve buscar quadrinhos via /comics?name= com sucesso', async () => {
      const mockHtml = `
        <div>
          <a href="/comics/solo-leveling-abc">
            <img src="https://asurascans.com/covers/solo.jpg" alt="Solo Leveling" />
            <span class="font-bold">Solo Leveling</span>
          </a>
          <a href="/comics/solo-max-level">
            <img src="https://asurascans.com/covers/max.jpg" alt="Solo Max Level" />
            <span class="font-bold">Solo Max Level</span>
          </a>
        </div>
      `

      mockHttpClient.get.mockResolvedValueOnce({
        status: 200,
        data: mockHtml,
      })

      const results = await strategy.search('Solo')

      expect(results).toHaveLength(2)
      expect(results[0]).toEqual({
        providerSlug: 'asurascans',
        title: 'Solo Leveling',
        url: 'https://asurascans.com/comics/solo-leveling-abc',
        coverUrl: 'https://asurascans.com/covers/solo.jpg',
        type: undefined,
      })
      expect(results[1].title).toBe('Solo Max Level')
    })

    it('deve respeitar a opção limit', async () => {
      const mockHtml = `
        <div>
          <a href="/comics/manga-1"><img src="/c1.jpg" alt="Manga 1" /></a>
          <a href="/comics/manga-2"><img src="/c2.jpg" alt="Manga 2" /></a>
          <a href="/comics/manga-3"><img src="/c3.jpg" alt="Manga 3" /></a>
        </div>
      `

      mockHttpClient.get.mockResolvedValueOnce({
        status: 200,
        data: mockHtml,
      })

      const results = await strategy.search('Manga', { limit: 2 })
      expect(results).toHaveLength(2)
    })

    it('deve fazer fallback para /browse?search= se /comics?name falhar', async () => {
      mockHttpClient.get.mockRejectedValueOnce(new Error('comics route failed'))
      mockHttpClient.get.mockResolvedValueOnce({
        status: 200,
        data: `
          <div>
            <a href="/comics/fallback-manga">
              <img src="/fb.jpg" alt="Fallback Manga" />
            </a>
          </div>
        `,
      })

      const results = await strategy.search('fallback')
      expect(results).toHaveLength(1)
      expect(results[0].title).toBe('Fallback Manga')
    })
  })

  describe('inspect', () => {
    it('deve inspecionar obra e extrair metadados e capítulos ordenados', async () => {
      const mockHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Myst, Might, Mayhem - Asura Scans</title>
            <meta property="og:description" content="In a realm governed by mystic arts..." />
          </head>
          <body>
            <h1>Myst, Might, Mayhem</h1>
            <img src="https://asurascans.com/covers/myst.jpg" />
            <span>Ongoing</span>
            <a href="/browse?author=AuthorName">AuthorName</a>
            <a href="/browse?genres=Action">Action</a>
            <a href="/browse?genres=Fantasy">Fantasy</a>
            
            <a href="/comics/myst-might-mayhem/chapter/117">
              <span class="font-medium">Chapter 117</span>
              <span class="truncate">The Final Battle</span>
            </a>
            <a href="/comics/myst-might-mayhem/chapter/1">
              <span class="font-medium">Chapter 1</span>
              <span class="truncate">Prologue</span>
            </a>
            <a href="/comics/myst-might-mayhem/chapter/2">
              <span class="font-medium">Chapter 2</span>
              <span class="truncate">Beginning</span>
            </a>
          </body>
        </html>
      `

      mockHttpClient.get.mockResolvedValueOnce({
        status: 200,
        data: mockHtml,
      })

      const details = await strategy.inspect('https://asurascans.com/comics/myst-might-mayhem')

      expect(details.metadata.title).toBe('Myst, Might, Mayhem')
      expect(details.metadata.author).toBe('AuthorName')
      expect(details.metadata.status).toBe('ongoing')
      expect(details.metadata.genres).toEqual(['Action', 'Fantasy'])
      expect(details.metadata.description).toBe('In a realm governed by mystic arts...')
      expect(details.covers[0].imageUrl).toBe('https://asurascans.com/covers/myst.jpg')

      expect(details.chapters).toHaveLength(3)
      // Ordenação crescente
      expect(details.chapters[0].number).toBe('1')
      expect(details.chapters[0].title).toBe('Chapter 1 - Prologue')
      expect(details.chapters[1].number).toBe('2')
      expect(details.chapters[2].number).toBe('117')
      expect(details.statistics.chapters).toBe(3)
      expect(details.statistics.covers).toBe(1)
    })

    it('deve normalizar URL caso URL de capítulo seja passada para inspect', async () => {
      mockHttpClient.get.mockResolvedValueOnce({
        status: 200,
        data: `
          <h1>Solo Leveling</h1>
          <img src="/covers/solo.jpg" />
          <a href="/comics/solo-leveling/chapter/1"><span>Chapter 1</span></a>
        `,
      })

      const details = await strategy.inspect('https://asurascans.com/comics/solo-leveling/chapter/10')
      expect(mockHttpClient.get).toHaveBeenCalledWith(
        'https://asurascans.com/comics/solo-leveling',
        expect.anything(),
      )
      expect(details.metadata.title).toBe('Solo Leveling')
    })
  })

  describe('getChapterImages', () => {
    it('deve extrair URLs de imagens das páginas do capítulo', async () => {
      const mockHtml = `
        <html>
          <body>
            <div id="readerarea">
              <img src="https://asurascans.com/chapters/1/01.jpg" alt="Page 1" />
              <img src="https://asurascans.com/chapters/1/02.jpg" alt="Page 2" />
              <img src="https://asurascans.com/chapters/1/03.jpg" alt="Page 3" />
            </div>
            <img src="https://asurascans.com/images/logo.png" alt="Logo" />
          </body>
        </html>
      `

      mockHttpClient.get.mockResolvedValueOnce({
        status: 200,
        data: mockHtml,
      })

      const pages = await strategy.getChapterImages(
        'https://asurascans.com/comics/solo-leveling/chapter/1',
      )

      expect(pages).toEqual([
        'https://asurascans.com/chapters/1/01.jpg',
        'https://asurascans.com/chapters/1/02.jpg',
        'https://asurascans.com/chapters/1/03.jpg',
      ])
    })

    it('deve lançar ScrapingParseError quando nenhuma imagem for encontrada', async () => {
      mockHttpClient.get.mockResolvedValueOnce({
        status: 200,
        data: '<html><body>Empty</body></html>',
      })

      await expect(
        strategy.getChapterImages('https://asurascans.com/comics/solo-leveling/chapter/1'),
      ).rejects.toThrow(ScrapingParseError)
    })
  })

  describe('downloadImage', () => {
    it('deve baixar imagem e retornar Buffer e contentType', async () => {
      const buffer = Buffer.from('fake-image-bytes')
      mockHttpClient.get.mockResolvedValueOnce({
        status: 200,
        data: buffer,
        headers: { 'content-type': 'image/webp' },
      })

      const result = await strategy.downloadImage('https://asurascans.com/chapters/1/01.webp')

      expect(result.buffer).toBeInstanceOf(Buffer)
      expect(result.contentType).toBe('image/webp')
    })
  })

  describe('Funções do Mapper', () => {
    describe('normalizeStatus', () => {
      it('deve mapear status corretamente', () => {
        expect(normalizeStatus('Ongoing')).toBe('ongoing')
        expect(normalizeStatus('Completed')).toBe('completed')
        expect(normalizeStatus('Hiatus')).toBe('hiatus')
        expect(normalizeStatus('Dropped')).toBe('cancelled')
        expect(normalizeStatus('Cancelled')).toBe('cancelled')
        expect(normalizeStatus(null)).toBe('unknown')
      })
    })

    describe('extractChapterNumber', () => {
      it('deve extrair número de capítulo a partir do link ou texto', () => {
        expect(extractChapterNumber('/comics/solo/chapter/105.5')).toBe('105.5')
        expect(extractChapterNumber('Chapter 42')).toBe('42')
        expect(extractChapterNumber('Capítulo 99')).toBe('99')
      })
    })

    describe('toAbsoluteUrl', () => {
      it('deve converter URLs relativas para absolutas', () => {
        expect(toAbsoluteUrl('/comics/solo', 'https://asurascans.com')).toBe(
          'https://asurascans.com/comics/solo',
        )
        expect(toAbsoluteUrl('https://example.com/img.jpg', 'https://asurascans.com')).toBe(
          'https://example.com/img.jpg',
        )
      })
    })
  })
})
