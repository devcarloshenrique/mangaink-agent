import { describe, it, expect } from 'vitest'
import * as cheerio from 'cheerio'
import {
  parseMangaReadSearchResult,
  mapMangaReadToInspectResponse,
  parseMangaReadChapterImages,
  MANGAREAD_BASE_URL,
} from './mangaread.parser'

describe('mangaread.parser', () => {
  describe('parseMangaReadSearchResult', () => {
    it('deve extrair resultados da busca', () => {
      const html = `
        <div class="row c-tabs-item__content">
          <div class="tab-thumb">
            <img data-src="https://www.mangaread.org/wp-content/uploads/cover.jpg" />
          </div>
          <div class="post-title">
            <h3><a href="https://www.mangaread.org/manga/solo-leveling/">Solo Leveling</a></h3>
          </div>
          <div class="mg_author">
            <div class="summary-content">Chugong</div>
          </div>
        </div>
      `
      const $ = cheerio.load(html)
      const results = parseMangaReadSearchResult($, MANGAREAD_BASE_URL)

      expect(results).toHaveLength(1)
      expect(results[0]).toEqual({
        title: 'Solo Leveling',
        url: 'https://www.mangaread.org/manga/solo-leveling/',
        coverUrl: 'https://www.mangaread.org/wp-content/uploads/cover.jpg',
        author: 'Chugong',
      })
    })
  })

  describe('mapMangaReadToInspectResponse', () => {
    it('deve extrair metadados, capas e capítulos', () => {
      const html = `
        <div class="post-title"><h1>Solo Leveling</h1></div>
        <div class="author-content"><a href="#">Chugong</a></div>
        <div class="description-summary"><div class="summary__content">Sinopse aqui...</div></div>
        <div class="post-status"><div class="summary-content">Completed</div></div>
        <div class="genres-content"><a href="#">Action</a></div>
        <div class="summary_image"><img data-src="https://www.mangaread.org/wp-content/uploads/cover.jpg" /></div>
        <ul>
          <li class="wp-manga-chapter"><a href="https://www.mangaread.org/manga/solo-leveling/chapter-2/">Chapter 2</a></li>
          <li class="wp-manga-chapter"><a href="https://www.mangaread.org/manga/solo-leveling/chapter-1/">Chapter 1</a></li>
        </ul>
      `
      const $ = cheerio.load(html)
      const inspected = mapMangaReadToInspectResponse(
        $,
        'https://www.mangaread.org/manga/solo-leveling/',
      )

      expect(inspected.metadata.title).toBe('Solo Leveling')
      expect(inspected.metadata.author).toBe('Chugong')
      expect(inspected.metadata.status).toBe('completed')
      expect(inspected.metadata.genres).toEqual(['Action'])
      expect(inspected.covers).toHaveLength(1)
      expect(inspected.chapters).toHaveLength(2)
      expect(inspected.chapters[0].number).toBe('1')
      expect(inspected.chapters[1].number).toBe('2')
    })
  })

  describe('parseMangaReadChapterImages', () => {
    it('deve extrair imagens de capítulos', () => {
      const html = `
        <div class="reading-content">
          <img data-src="https://www.mangaread.org/wp-content/uploads/ch1/01.jpg" />
          <img data-src="https://www.mangaread.org/wp-content/uploads/ch1/02.jpg" />
        </div>
      `
      const $ = cheerio.load(html)
      const pages = parseMangaReadChapterImages($)

      expect(pages).toEqual([
        'https://www.mangaread.org/wp-content/uploads/ch1/01.jpg',
        'https://www.mangaread.org/wp-content/uploads/ch1/02.jpg',
      ])
    })
  })
})
