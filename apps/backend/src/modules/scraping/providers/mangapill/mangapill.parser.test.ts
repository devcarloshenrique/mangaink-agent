import { describe, it, expect } from 'vitest'
import * as cheerio from 'cheerio'
import {
  parseMangapillSearchResult,
  mapMangapillToInspectResponse,
  parseMangapillChapterImages,
  MANGAPILL_BASE_URL,
} from './mangapill.parser'

describe('mangapill.parser', () => {
  describe('parseMangapillSearchResult', () => {
    it('deve extrair itens da busca corretamente', () => {
      const html = `
        <div>
          <a href="/manga/5121/ori-no-naka-no-soloist">
            <img data-src="https://cdn.readdetectiveconan.com/file/mangap/cover/5121.jpeg" />
            <div class="leading-tight">Ori no Naka no Soloist</div>
          </a>
        </div>
      `
      const $ = cheerio.load(html)
      const results = parseMangapillSearchResult($, MANGAPILL_BASE_URL)

      expect(results).toHaveLength(1)
      expect(results[0]).toEqual({
        title: 'Ori no Naka no Soloist',
        url: 'https://mangapill.com/manga/5121/ori-no-naka-no-soloist',
        coverUrl: 'https://cdn.readdetectiveconan.com/file/mangap/cover/5121.jpeg',
        author: null,
      })
    })

    it('deve extrair capa quando imagem e título estão em links irmãos no mesmo card', () => {
      const html = `
        <div>
          <a href="/manga/3069/naruto" class="relative block">
            <figure>
              <img data-src="https://cdn.readdetectiveconan.com/file/mangapill/i/3069.jpg" alt="Naruto" />
            </figure>
          </a>
          <div>
            <a href="/manga/3069/naruto">
              <div class="leading-tight font-black">Naruto</div>
            </a>
          </div>
        </div>
      `
      const $ = cheerio.load(html)
      const results = parseMangapillSearchResult($, MANGAPILL_BASE_URL)

      expect(results).toHaveLength(1)
      expect(results[0]).toEqual({
        title: 'Naruto',
        url: 'https://mangapill.com/manga/3069/naruto',
        coverUrl: 'https://cdn.readdetectiveconan.com/file/mangapill/i/3069.jpg',
        author: null,
      })
    })
  })

  describe('mapMangapillToInspectResponse', () => {
    it('deve extrair metadados, capas e capítulos', () => {
      const html = `
        <div>
          <h1>Ori no Naka no Soloist</h1>
          <p class="text-sm">A prison city where criminals are banished...</p>
          <figure>
            <img src="https://cdn.readdetectiveconan.com/file/mangap/cover/5121.jpeg" />
          </figure>
          <div class="grid">
            <div><div>Status</div><div>Publishing</div></div>
          </div>
          <div>
            <a href="/genres/action">Action</a>
            <a href="/genres/drama">Drama</a>
          </div>
          <div id="chapters">
            <a href="/chapters/5121-10020000/ori-no-naka-no-soloist-chapter-20">Chapter 20</a>
            <a href="/chapters/5121-10001000/ori-no-naka-no-soloist-chapter-1">Chapter 1</a>
          </div>
        </div>
      `
      const $ = cheerio.load(html)
      const inspected = mapMangapillToInspectResponse(
        $,
        'https://mangapill.com/manga/5121/ori-no-naka-no-soloist',
      )

      expect(inspected.metadata.title).toBe('Ori no Naka no Soloist')
      expect(inspected.metadata.status).toBe('ongoing')
      expect(inspected.metadata.genres).toEqual(['Action', 'Drama'])
      expect(inspected.covers).toHaveLength(1)
      expect(inspected.chapters).toHaveLength(2)
      expect(inspected.chapters[0].number).toBe('1')
      expect(inspected.chapters[1].number).toBe('20')
    })
  })

  describe('parseMangapillChapterImages', () => {
    it('deve extrair links das imagens de páginas', () => {
      const html = `
        <div>
          <picture>
            <img data-src="https://cdn.readdetectiveconan.com/file/mangap/5121/10020000/1.jpeg" />
          </picture>
          <picture>
            <img data-src="https://cdn.readdetectiveconan.com/file/mangap/5121/10020000/2.jpeg" />
          </picture>
        </div>
      `
      const $ = cheerio.load(html)
      const pages = parseMangapillChapterImages($)

      expect(pages).toEqual([
        'https://cdn.readdetectiveconan.com/file/mangap/5121/10020000/1.jpeg',
        'https://cdn.readdetectiveconan.com/file/mangap/5121/10020000/2.jpeg',
      ])
    })
  })
})
