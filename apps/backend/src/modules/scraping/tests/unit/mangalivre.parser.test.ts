import { describe, expect, it } from 'vitest'
import * as cheerio from 'cheerio'
import { parseChapters, parseMetadata, parseCover } from '../../providers/mangalivre/mangalivre.parser'

const SOURCE_URL = 'https://mangalivre.to/manga/hunter-x-hunter/'
const BASE_URL = 'https://mangalivre.to'

describe('MangaLivre Parser - Unit Tests', () => {
  describe('parseMetadata', () => {
    it('deve extrair título do h1', () => {
      const $ = cheerio.load('<h1>Hunter x Hunter</h1>')
      const result = parseMetadata($, SOURCE_URL)
      expect(result.title).toBe('Hunter x Hunter')
    })

    it('deve extrair título do meta og:title quando h1 não existir', () => {
      const $ = cheerio.load('<meta property="og:title" content="One Piece" />')
      const result = parseMetadata($, SOURCE_URL)
      expect(result.title).toBe('One Piece')
    })

    it('deve usar título padrão quando não encontrar título', () => {
      const $ = cheerio.load('<div>No title</div>')
      const result = parseMetadata($, SOURCE_URL)
      expect(result.title).toBe('Manga Desconhecido')
    })

    it('deve extrair autor', () => {
      const $ = cheerio.load('<a href="/manga-author/test/">Test Author</a>')
      const result = parseMetadata($, SOURCE_URL)
      expect(result.author).toBe('Test Author')
    })

    it('deve extrair descrição', () => {
      const $ = cheerio.load('<div class="description">Test Description</div>')
      const result = parseMetadata($, SOURCE_URL)
      expect(result.description).toBe('Test Description')
    })

    it('deve extrair descrição do meta og:description', () => {
      const $ = cheerio.load('<meta property="og:description" content="Meta Description" />')
      const result = parseMetadata($, SOURCE_URL)
      expect(result.description).toBe('Meta Description')
    })

    it('deve priorizar gêneros do .genres-content', () => {
      const $ = cheerio.load(`
        <div class="genres-content">
          <a href="/genero/acao/">Ação</a>
          <a href="/genero/aventura/">Aventura</a>
        </div>
        <a href="/genero/romance/">Romance</a>
      `)
      const result = parseMetadata($, SOURCE_URL)
      expect(result.genres).toEqual(['Ação', 'Aventura'])
    })

    it('deve usar fallback de gêneros quando .genres-content não existir', () => {
      const $ = cheerio.load(`
        <a href="/genero/acao/">Ação</a>
        <a href="/genero/aventura/">Aventura</a>
      `)
      const result = parseMetadata($, SOURCE_URL)
      expect(result.genres).toEqual(['Ação', 'Aventura'])
    })

    it('deve remover gêneros duplicados', () => {
      const $ = cheerio.load(`
        <div class="genres-content">
          <a href="/genero/acao/">Ação</a>
          <a href="/genero/acao/">Ação</a>
        </div>
      `)
      const result = parseMetadata($, SOURCE_URL)
      expect(result.genres).toEqual(['Ação'])
    })

    it('deve detectar status ongoing', () => {
      const $ = cheerio.load('<body>Status: em andamento</body>')
      const result = parseMetadata($, SOURCE_URL)
      expect(result.status).toBe('ongoing')
    })

    it('deve detectar status completed', () => {
      const $ = cheerio.load('<body>Status: completo</body>')
      const result = parseMetadata($, SOURCE_URL)
      expect(result.status).toBe('completed')
    })
  })

  describe('parseCover', () => {
    it('deve extrair cover do seletor .summary_image img', () => {
      const $ = cheerio.load('<div class="summary_image"><img src="https://example.com/cover.jpg" /></div>')
      const result = parseCover($, BASE_URL)
      expect(result).toHaveLength(1)
      expect(result[0].imageUrl).toBe('https://example.com/cover.jpg')
    })

    it('deve extrair cover do seletor .tab-summary img', () => {
      const $ = cheerio.load('<div class="tab-summary"><img src="https://example.com/cover.jpg" /></div>')
      const result = parseCover($, BASE_URL)
      expect(result).toHaveLength(1)
      expect(result[0].imageUrl).toBe('https://example.com/cover.jpg')
    })

    it('deve extrair cover do meta og:image', () => {
      const $ = cheerio.load('<meta property="og:image" content="https://example.com/cover.jpg" />')
      const result = parseCover($, BASE_URL)
      expect(result).toHaveLength(1)
      expect(result[0].imageUrl).toBe('https://example.com/cover.jpg')
    })

    it('deve extrair cover do atributo data-src', () => {
      const $ = cheerio.load('<div class="summary_image"><img data-src="https://example.com/cover.jpg" /></div>')
      const result = parseCover($, BASE_URL)
      expect(result).toHaveLength(1)
      expect(result[0].imageUrl).toBe('https://example.com/cover.jpg')
    })

    it('deve extrair cover do atributo data-lazy-src', () => {
      const $ = cheerio.load('<div class="summary_image"><img data-lazy-src="https://example.com/cover.jpg" /></div>')
      const result = parseCover($, BASE_URL)
      expect(result).toHaveLength(1)
      expect(result[0].imageUrl).toBe('https://example.com/cover.jpg')
    })

    it('deve retornar array vazio quando não encontrar cover', () => {
      const $ = cheerio.load('<div>No cover</div>')
      const result = parseCover($, BASE_URL)
      expect(result).toHaveLength(0)
    })

    it('deve gerar ID de cover corretamente', () => {
      const $ = cheerio.load('<div class="summary_image"><img src="https://example.com/cover.jpg" /></div>')
      const result = parseCover($, BASE_URL)
      expect(result[0].id).toBe('cover_001')
    })

    it('deve gerar tipo de cover como "original"', () => {
      const $ = cheerio.load('<div class="summary_image"><img src="https://example.com/cover.jpg" /></div>')
      const result = parseCover($, BASE_URL)
      expect(result[0].type).toBe('original')
    })

    it('deve gerar label de cover como "Original"', () => {
      const $ = cheerio.load('<div class="summary_image"><img src="https://example.com/cover.jpg" /></div>')
      const result = parseCover($, BASE_URL)
      expect(result[0].label).toBe('Original')
    })
  })

  describe('parseChapters', () => {
    it('deve extrair capítulos com números inteiros', () => {
      const $ = cheerio.load(`
        <a href="/manga/hunter-x-hunter/capitulo-1/">Capítulo 1</a>
        <a href="/manga/hunter-x-hunter/capitulo-2/">Capítulo 2</a>
        <a href="/manga/hunter-x-hunter/capitulo-3/">Capítulo 3</a>
      `)
      const result = parseChapters($, BASE_URL, SOURCE_URL)
      expect(result).toHaveLength(3)
      expect(result[0].number).toBe('1')
      expect(result[1].number).toBe('2')
      expect(result[2].number).toBe('3')
    })

    it('deve extrair capítulos com números decimais', () => {
      const $ = cheerio.load(`
        <a href="/manga/hunter-x-hunter/capitulo-0-5/">Capítulo 0.5</a>
        <a href="/manga/hunter-x-hunter/capitulo-3_1/">Capítulo 3.1</a>
        <a href="/manga/hunter-x-hunter/capitulo-340-6/">Capítulo 340.6</a>
      `)
      const result = parseChapters($, BASE_URL, SOURCE_URL)
      expect(result).toHaveLength(3)
      expect(result[0].number).toBe('0.5')
      expect(result[1].number).toBe('3.1')
      expect(result[2].number).toBe('340.6')
    })

    it('deve ignorar capítulos de outras obras', () => {
      const $ = cheerio.load(`
        <a href="/manga/hunter-x-hunter/capitulo-1/">Capítulo 1</a>
        <a href="/manga/one-piece/capitulo-1/">Capítulo 1 (Outra Obra)</a>
      `)
      const result = parseChapters($, BASE_URL, SOURCE_URL)
      expect(result).toHaveLength(1)
      expect(result[0].number).toBe('1')
    })

    it('deve ordenar capítulos por número crescente', () => {
      const $ = cheerio.load(`
        <a href="/manga/hunter-x-hunter/capitulo-5/">Capítulo 5</a>
        <a href="/manga/hunter-x-hunter/capitulo-1/">Capítulo 1</a>
        <a href="/manga/hunter-x-hunter/capitulo-3/">Capítulo 3</a>
      `)
      const result = parseChapters($, BASE_URL, SOURCE_URL)
      expect(result).toHaveLength(3)
      expect(result[0].number).toBe('1')
      expect(result[1].number).toBe('3')
      expect(result[2].number).toBe('5')
    })

    it('deve remover capítulos duplicados', () => {
      const $ = cheerio.load(`
        <a href="/manga/hunter-x-hunter/capitulo-1/">Capítulo 1</a>
        <a href="/manga/hunter-x-hunter/capitulo-1/">Capítulo 1 (Duplicate)</a>
      `)
      const result = parseChapters($, BASE_URL, SOURCE_URL)
      expect(result).toHaveLength(1)
    })

    it('deve usar título padrão para capítulos com título muito longo', () => {
      const longTitle = 'A'.repeat(100)
      const $ = cheerio.load(`
        <a href="/manga/hunter-x-hunter/capitulo-1/">${longTitle}</a>
      `)
      const result = parseChapters($, BASE_URL, SOURCE_URL)
      expect(result[0].title).toBe('Capítulo 1')
    })

    it('deve gerar IDs de capítulo corretamente', () => {
      const $ = cheerio.load(`
        <a href="/manga/hunter-x-hunter/capitulo-1/">Capítulo 1</a>
        <a href="/manga/hunter-x-hunter/capitulo-2/">Capítulo 2</a>
      `)
      const result = parseChapters($, BASE_URL, SOURCE_URL)
      expect(result[0].id).toBe('chap_0001')
      expect(result[1].id).toBe('chap_0002')
    })

    it('deve gerar URLs absolutas', () => {
      const $ = cheerio.load(`
        <a href="/manga/hunter-x-hunter/capitulo-1/">Capítulo 1</a>
      `)
      const result = parseChapters($, BASE_URL, SOURCE_URL)
      expect(result[0].url).toBe('https://mangalivre.to/manga/hunter-x-hunter/capitulo-1/')
    })
  })
})
