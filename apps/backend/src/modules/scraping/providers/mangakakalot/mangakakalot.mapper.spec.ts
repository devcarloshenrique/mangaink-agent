import { describe, it, expect } from 'vitest'
import {
  normalizeStatus,
  extractChapterNumber,
  extractVolume,
  parseSearchResults,
  parseChaptersFromHtml,
  mapApiChaptersToChapters,
  mapMangaDetails,
  parseChapterImages,
} from './mangakakalot.mapper'
import type { ProviderInfo } from '../../types/provider.types'

describe('MangaKakalot Mapper', () => {
  const providerInfo: ProviderInfo = {
    slug: 'mangakakalot',
    name: 'MangaKakalot',
    engine: 'cheerio',
  }

  describe('normalizeStatus', () => {
    it('deve mapear status em andamento para ongoing', () => {
      expect(normalizeStatus('Ongoing')).toBe('ongoing')
      expect(normalizeStatus('ongoing')).toBe('ongoing')
      expect(normalizeStatus('Em Andamento')).toBe('ongoing')
    })

    it('deve mapear status finalizado para completed', () => {
      expect(normalizeStatus('Completed')).toBe('completed')
      expect(normalizeStatus('completed')).toBe('completed')
      expect(normalizeStatus('Concluído')).toBe('completed')
    })

    it('deve mapear status hiato e cancelado', () => {
      expect(normalizeStatus('Hiatus')).toBe('hiatus')
      expect(normalizeStatus('Cancelled')).toBe('cancelled')
      expect(normalizeStatus('Discontinued')).toBe('cancelled')
    })

    it('deve retornar unknown para valores desconhecidos ou vazios', () => {
      expect(normalizeStatus('')).toBe('unknown')
      expect(normalizeStatus(undefined)).toBe('unknown')
      expect(normalizeStatus(null)).toBe('unknown')
      expect(normalizeStatus('Other')).toBe('unknown')
    })
  })

  describe('extractChapterNumber', () => {
    it('deve extrair números de capítulos com padrão Chapter XX', () => {
      expect(extractChapterNumber('Chapter 01')).toBe('01')
      expect(extractChapterNumber('Chapter 700.6')).toBe('700.6')
      expect(extractChapterNumber('Ch. 55')).toBe('55')
      expect(extractChapterNumber('Capítulo 12,5')).toBe('12.5')
    })

    it('deve usar dataNum quando fornecido em formato numérico', () => {
      expect(extractChapterNumber('Special Extra', '25')).toBe('25')
      expect(extractChapterNumber('Chapter Extra', '25.5')).toBe('25.5')
    })

    it('deve retornar fallback quando não encontrar padrão explícito', () => {
      expect(extractChapterNumber('Episode 42')).toBe('42')
    })
  })

  describe('extractVolume', () => {
    it('deve extrair número de volume', () => {
      expect(extractVolume('Vol. 1 Chapter 2')).toBe(1)
      expect(extractVolume('Volume 12 Chapter 100')).toBe(12)
    })

    it('deve retornar null quando não houver número de volume', () => {
      expect(extractVolume('Chapter 1')).toBeNull()
      expect(extractVolume('')).toBeNull()
    })
  })

  describe('parseSearchResults', () => {
    const html = `
      <div class="panel_story_list">
        <div class="story_item">
          <a href="/manga/naruto">
            <img src="https://img-r1.2xstorage.com/thumb/naruto.webp" alt="Naruto" />
          </a>
          <div class="story_item_right">
            <h3 class="story_name"><a href="/manga/naruto">Naruto</a></h3>
            <span>Author(s) : Masashi Kishimoto</span>
            <em class="story_chapter"><a href="/manga/naruto/chapter-700-6">Chapter 700.6</a></em>
          </div>
        </div>
        <div class="story_item">
          <a href="/manga/boruto">
            <img data-src="https://img-r1.2xstorage.com/thumb/boruto.webp" alt="Boruto" />
          </a>
          <div class="story_item_right">
            <h3 class="story_name"><a href="/manga/boruto">Boruto</a></h3>
            <span>Author(s) : Ukyo Kodachi</span>
          </div>
        </div>
      </div>
    `

    it('deve parsear resultados de busca corretamente', () => {
      const results = parseSearchResults(html, 'https://www.mangakakalot.gg')
      expect(results).toHaveLength(2)
      expect(results[0]).toEqual({
        providerSlug: 'mangakakalot',
        title: 'Naruto',
        url: 'https://www.mangakakalot.gg/manga/naruto',
        coverUrl: 'https://img-r1.2xstorage.com/thumb/naruto.webp',
        author: 'Masashi Kishimoto',
        type: 'Manga',
      })
      expect(results[1]).toEqual({
        providerSlug: 'mangakakalot',
        title: 'Boruto',
        url: 'https://www.mangakakalot.gg/manga/boruto',
        coverUrl: 'https://img-r1.2xstorage.com/thumb/boruto.webp',
        author: 'Ukyo Kodachi',
        type: 'Manga',
      })
    })

    it('deve suportar fallback para links com /manga/', () => {
      const fallbackHtml = `
        <div>
          <a href="/manga/one-piece" title="One Piece">
            <img src="/thumb/one-piece.jpg" />
          </a>
        </div>
      `
      const results = parseSearchResults(fallbackHtml, 'https://www.mangakakalot.gg')
      expect(results).toHaveLength(1)
      expect(results[0].title).toBe('One Piece')
      expect(results[0].url).toBe('https://www.mangakakalot.gg/manga/one-piece')
    })
  })

  describe('parseChaptersFromHtml', () => {
    const html = `
      <div class="chapter-list">
        <div class="row">
          <span><a href="/manga/naruto/chapter-1">Chapter 1</a></span>
          <span>12 hours ago</span>
        </div>
        <div class="row">
          <span><a href="/manga/naruto/chapter-2">Chapter 2</a></span>
          <span>10 hours ago</span>
        </div>
      </div>
    `

    it('deve extrair capítulos ordenados', () => {
      const chapters = parseChaptersFromHtml(html, 'https://www.mangakakalot.gg')
      expect(chapters).toHaveLength(2)
      expect(chapters[0].number).toBe('1')
      expect(chapters[0].url).toBe('https://www.mangakakalot.gg/manga/naruto/chapter-1')
      expect(chapters[1].number).toBe('2')
      expect(chapters[1].url).toBe('https://www.mangakakalot.gg/manga/naruto/chapter-2')
    })
  })

  describe('mapApiChaptersToChapters', () => {
    it('deve mapear capítulos da API corretamente', () => {
      const apiChapters = [
        {
          chapter_name: 'Chapter 2',
          chapter_slug: 'chapter-2',
          chapter_num: 2,
        },
        {
          chapter_name: 'Chapter 1',
          chapter_slug: 'chapter-1',
          chapter_num: 1,
        },
      ]

      const chapters = mapApiChaptersToChapters(apiChapters, 'https://www.mangakakalot.gg', 'naruto')
      expect(chapters).toHaveLength(2)
      expect(chapters[0].number).toBe('1')
      expect(chapters[0].url).toBe('https://www.mangakakalot.gg/manga/naruto/chapter-1')
      expect(chapters[1].number).toBe('2')
      expect(chapters[1].url).toBe('https://www.mangakakalot.gg/manga/naruto/chapter-2')
    })
  })

  describe('mapMangaDetails', () => {
    const html = `
      <div class="manga-info-top">
        <div class="manga-info-pic">
          <img src="https://img-r1.2xstorage.com/thumb/naruto.webp" alt="Naruto" />
        </div>
        <ul class="manga-info-text">
          <li><h1>Naruto</h1></li>
          <li>Author(s) : Masashi Kishimoto</li>
          <li>Status : Completed</li>
          <li>Genres : <a href="/genre/action">Action</a>, <a href="/genre/shounen">Shounen</a></li>
        </ul>
      </div>
      <div id="noidungm">
        <h2>Naruto summary:</h2>
        Naruto Uzumaki is a young ninja who seeks recognition from his peers and dreams of becoming the Hokage.
      </div>
      <div class="chapter-list">
        <div class="row">
          <span><a href="/manga/naruto/chapter-1">Chapter 1</a></span>
        </div>
      </div>
    `

    it('deve extrair detalhes da obra corretamente', () => {
      const manga = mapMangaDetails(html, 'https://www.mangakakalot.gg/manga/naruto', providerInfo)
      expect(manga.metadata.title).toBe('Naruto')
      expect(manga.metadata.status).toBe('completed')
      expect(manga.metadata.author).toBe('Masashi Kishimoto')
      expect(manga.metadata.genres).toContain('Action')
      expect(manga.metadata.genres).toContain('Shounen')
      expect(manga.metadata.description).toContain('Naruto Uzumaki is a young ninja')
      expect(manga.covers).toHaveLength(1)
      expect(manga.covers[0].imageUrl).toBe('https://img-r1.2xstorage.com/thumb/naruto.webp')
      expect(manga.chapters).toHaveLength(1)
      expect(manga.statistics.chapters).toBe(1)
    })
  })

  describe('parseChapterImages', () => {
    it('deve extrair imagens a partir de script tags var chapterImages', () => {
      const html = `
        <script>
          var cdns = ["https://imgs-2.2xstorage.com"];
          var chapterImages = ["naruto/1/0.webp", "naruto/1/1.webp"];
        </script>
      `
      const images = parseChapterImages(html, 'https://www.mangakakalot.gg')
      expect(images).toHaveLength(2)
      expect(images[0]).toBe('https://imgs-2.2xstorage.com/naruto/1/0.webp')
      expect(images[1]).toBe('https://imgs-2.2xstorage.com/naruto/1/1.webp')
    })

    it('deve extrair imagens a partir do DOM', () => {
      const html = `
        <div class="container-chapter-reader">
          <img src="https://imgs-2.2xstorage.com/naruto/1/0.webp" />
          <img data-src="https://imgs-2.2xstorage.com/naruto/1/1.webp" />
          <img src="https://example.com/banner-ad.jpg" />
        </div>
      `
      const images = parseChapterImages(html, 'https://www.mangakakalot.gg')
      expect(images).toHaveLength(2)
      expect(images[0]).toBe('https://imgs-2.2xstorage.com/naruto/1/0.webp')
      expect(images[1]).toBe('https://imgs-2.2xstorage.com/naruto/1/1.webp')
    })
  })
})
