import { describe, expect, it } from 'vitest'
import {
  buildCoverUrl,
  extractChapterNumber,
  extractVolume,
  mapSeriesDetails,
  normalizeStatus,
  parseApiSeriesResults,
  parseBrowseHtml,
  parseChapterImages,
} from '../../providers/flamecomics/flamecomics.mapper'
import type { ProviderInfo } from '../../types/provider.types'

const fakeProviderInfo: ProviderInfo = {
  slug: 'flamecomics',
  name: 'Flame Comics',
  engine: 'cheerio',
}

describe('FlameComics Mapper', () => {
  describe('normalizeStatus', () => {
    it('deve normalizar status ongoing', () => {
      expect(normalizeStatus('Ongoing')).toBe('ongoing')
      expect(normalizeStatus('ongoing')).toBe('ongoing')
      expect(normalizeStatus('Em Lançamento')).toBe('ongoing')
    })

    it('deve normalizar status completed', () => {
      expect(normalizeStatus('Completed')).toBe('completed')
      expect(normalizeStatus('Finalizado')).toBe('completed')
    })

    it('deve normalizar status hiatus', () => {
      expect(normalizeStatus('Hiatus')).toBe('hiatus')
      expect(normalizeStatus('Hiato')).toBe('hiatus')
    })

    it('deve normalizar status cancelled/dropped', () => {
      expect(normalizeStatus('Cancelled')).toBe('cancelled')
      expect(normalizeStatus('Dropped')).toBe('cancelled')
    })

    it('deve retornar unknown para valores nulos ou desconhecidos', () => {
      expect(normalizeStatus(null)).toBe('unknown')
      expect(normalizeStatus(undefined)).toBe('unknown')
      expect(normalizeStatus('desconhecido')).toBe('unknown')
    })
  })

  describe('extractChapterNumber', () => {
    it('deve extrair de strings no formato "311.00"', () => {
      expect(extractChapterNumber('311.00')).toBe('311')
    })

    it('deve extrair de strings decimais "12.50"', () => {
      expect(extractChapterNumber('12.50')).toBe('12.5')
    })

    it('deve extrair de zero "0.00"', () => {
      expect(extractChapterNumber('0.00')).toBe('0')
    })

    it('deve extrair de "Chapter 42"', () => {
      expect(extractChapterNumber('Chapter 42')).toBe('42')
    })

    it('deve aceitar número direto', () => {
      expect(extractChapterNumber(15)).toBe('15')
    })

    it('deve retornar "0" para nulo ou indefinido', () => {
      expect(extractChapterNumber(null)).toBe('0')
      expect(extractChapterNumber(undefined)).toBe('0')
    })
  })

  describe('extractVolume', () => {
    it('deve extrair volume de "Vol. 3 Chapter 10"', () => {
      expect(extractVolume('Vol. 3 Chapter 10')).toBe(3)
    })

    it('deve extrair volume de "Volume 12"', () => {
      expect(extractVolume('Volume 12')).toBe(12)
    })

    it('deve retornar null se não houver volume', () => {
      expect(extractVolume('Chapter 10')).toBeNull()
      expect(extractVolume(null)).toBeNull()
    })
  })

  describe('buildCoverUrl', () => {
    it('deve montar a URL completa da CDN para capa relativa', () => {
      expect(buildCoverUrl(2, 'thumbnail.png')).toBe(
        'https://cdn.flamecomics.xyz/uploads/images/series/2/thumbnail.png',
      )
    })

    it('deve manter URL absoluta', () => {
      expect(buildCoverUrl(2, 'https://cdn.example.com/cover.jpg')).toBe(
        'https://cdn.example.com/cover.jpg',
      )
    })

    it('deve retornar null para capa vazia', () => {
      expect(buildCoverUrl(2, null)).toBeNull()
    })
  })

  describe('parseApiSeriesResults', () => {
    const mockItems = [
      {
        id: 2,
        label: "Omniscient Reader's Viewpoint",
        status: 'Ongoing',
        image: 'thumbnail.png',
        chapter_count: '312',
      },
      {
        id: 149,
        label: 'Black Haze (2025)',
        status: 'Ongoing',
        image: 'thumbnail.png',
        chapter_count: '88',
      },
      {
        id: 50,
        label: 'Solo Leveling',
        status: 'Completed',
        image: 'cover.jpg',
        chapter_count: '200',
      },
    ]

    it('deve mapear todos os itens quando query não for informada', () => {
      const results = parseApiSeriesResults(mockItems, undefined, fakeProviderInfo)
      expect(results).toHaveLength(3)
      expect(results[0].title).toBe("Omniscient Reader's Viewpoint")
      expect(results[0].url).toBe('https://flamecomics.xyz/series/2')
      expect(results[0].coverUrl).toBe(
        'https://cdn.flamecomics.xyz/uploads/images/series/2/thumbnail.png',
      )
    })

    it('deve filtrar por termo de busca', () => {
      const results = parseApiSeriesResults(mockItems, 'reader', fakeProviderInfo)
      expect(results).toHaveLength(1)
      expect(results[0].title).toBe("Omniscient Reader's Viewpoint")
    })

    it('deve respeitar o limit', () => {
      const results = parseApiSeriesResults(mockItems, undefined, fakeProviderInfo, 2)
      expect(results).toHaveLength(2)
    })
  })

  describe('parseBrowseHtml', () => {
    it('deve extrair obras a partir de __NEXT_DATA__', () => {
      const html = `
        <html>
          <body>
            <script id="__NEXT_DATA__" type="application/json">
              {
                "props": {
                  "pageProps": {
                    "series": [
                      {
                        "series_id": 2,
                        "title": "Omniscient Reader's Viewpoint",
                        "cover": "thumb.jpg",
                        "author": ["Sing Shong"],
                        "categories": ["Action", "Fantasy"]
                      }
                    ]
                  }
                }
              }
            </script>
          </body>
        </html>
      `
      const results = parseBrowseHtml(html, 'reader', fakeProviderInfo)
      expect(results).toHaveLength(1)
      expect(results[0].title).toBe("Omniscient Reader's Viewpoint")
      expect(results[0].author).toBe('Sing Shong')
      expect(results[0].genres).toEqual(['Action', 'Fantasy'])
    })

    it('deve fazer fallback para Cheerio se __NEXT_DATA__ não estiver presente', () => {
      const html = `
        <html>
          <body>
            <a href="/series/10">
              <img src="https://cdn.flamecomics.xyz/thumb.jpg" />
              <h2>Legendary Moonlight Sculptor</h2>
            </a>
          </body>
        </html>
      `
      const results = parseBrowseHtml(html, 'moonlight', fakeProviderInfo)
      expect(results).toHaveLength(1)
      expect(results[0].title).toBe('Legendary Moonlight Sculptor')
      expect(results[0].url).toBe('https://flamecomics.xyz/series/10')
    })
  })

  describe('mapSeriesDetails', () => {
    it('deve mapear os detalhes e capítulos completos a partir de __NEXT_DATA__', () => {
      const html = `
        <html>
          <body>
            <script id="__NEXT_DATA__" type="application/json">
              {
                "props": {
                  "pageProps": {
                    "series": {
                      "series_id": 2,
                      "title": "Omniscient Reader's Viewpoint",
                      "description": "<p>Sinopse da história</p>",
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
                        "chapter": "0.00",
                        "title": "Prologue",
                        "token": "tok0",
                        "release_date": 1600000000
                      },
                      {
                        "chapter_id": 101,
                        "series_id": 2,
                        "chapter": "1.00",
                        "title": "Starting Point",
                        "token": "tok1",
                        "release_date": 1600000001
                      }
                    ]
                  }
                }
              }
            </script>
          </body>
        </html>
      `
      const res = mapSeriesDetails(html, 'https://flamecomics.xyz/series/2', fakeProviderInfo)

      expect(res.metadata.title).toBe("Omniscient Reader's Viewpoint")
      expect(res.metadata.description).toBe('Sinopse da história')
      expect(res.metadata.status).toBe('ongoing')
      expect(res.metadata.author).toBe('Sing Shong')
      expect(res.metadata.genres).toEqual(['Action', 'Fantasy'])
      expect(res.source.language).toBe('en')
      expect(res.covers).toHaveLength(1)
      expect(res.covers[0].imageUrl).toBe(
        'https://cdn.flamecomics.xyz/uploads/images/series/2/thumbnail.png',
      )

      expect(res.chapters).toHaveLength(2)
      expect(res.chapters[0].number).toBe('0')
      expect(res.chapters[0].title).toBe('Prologue')
      expect(res.chapters[0].url).toBe('https://flamecomics.xyz/series/2/tok0')
      expect(res.chapters[1].number).toBe('1')
      expect(res.chapters[1].url).toBe('https://flamecomics.xyz/series/2/tok1')
      expect(res.statistics.chapters).toBe(2)
    })

    it('deve fazer fallback para Cheerio se __NEXT_DATA__ não estiver presente', () => {
      const html = `
        <html>
          <head>
            <meta property="og:title" content="Solo Leveling" />
            <meta property="og:image" content="https://cdn.flamecomics.xyz/uploads/images/series/50/thumb.png" />
            <meta name="description" content="Caçador mais fraco se torna o mais forte" />
          </head>
          <body>
            <h1>Solo Leveling</h1>
            <a href="/series/50/token1">Capítulo 1</a>
            <a href="/series/50/token2">Capítulo 2</a>
          </body>
        </html>
      `
      const res = mapSeriesDetails(html, 'https://flamecomics.xyz/series/50', fakeProviderInfo)

      expect(res.metadata.title).toBe('Solo Leveling')
      expect(res.metadata.description).toBe('Caçador mais fraco se torna o mais forte')
      expect(res.chapters).toHaveLength(2)
      expect(res.chapters[0].number).toBe('1')
      expect(res.chapters[1].number).toBe('2')
    })
  })

  describe('parseChapterImages', () => {
    it('deve extrair imagens a partir de __NEXT_DATA__ ordenadas por índice', () => {
      const html = `
        <html>
          <body>
            <script id="__NEXT_DATA__" type="application/json">
              {
                "props": {
                  "pageProps": {
                    "chapter": {
                      "series_id": 2,
                      "token": "tok0",
                      "images": {
                        "1": { "name": "page2.jpg" },
                        "0": { "name": "page1.jpg" }
                      }
                    }
                  }
                }
              }
            </script>
          </body>
        </html>
      `
      const images = parseChapterImages(html)
      expect(images).toHaveLength(2)
      expect(images[0]).toBe('https://cdn.flamecomics.xyz/uploads/images/series/2/tok0/page1.jpg')
      expect(images[1]).toBe('https://cdn.flamecomics.xyz/uploads/images/series/2/tok0/page2.jpg')
    })

    it('deve fazer fallback para Cheerio com tags img', () => {
      const html = `
        <html>
          <body>
            <img src="https://cdn.flamecomics.xyz/uploads/images/series/2/tok0/01.jpg?v=1" />
            <img src="https://cdn.flamecomics.xyz/uploads/images/series/2/tok0/02.jpg" />
            <img src="https://cdn.flamecomics.xyz/uploads/images/series/2/thumbnail.png" />
          </body>
        </html>
      `
      const images = parseChapterImages(html)
      expect(images).toHaveLength(2)
      expect(images[0]).toBe('https://cdn.flamecomics.xyz/uploads/images/series/2/tok0/01.jpg')
      expect(images[1]).toBe('https://cdn.flamecomics.xyz/uploads/images/series/2/tok0/02.jpg')
    })
  })
})
