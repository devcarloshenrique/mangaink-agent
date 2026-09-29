import { describe, it, expect } from 'vitest'
import {
  extractMediaTitle,
  buildCoverUrl,
  parseTaiyoSearchResult,
  mapTaiyoToInspectResponse,
  parseTaiyoPages,
  TAIYO_BASE_URL,
  TAIYO_CDN_URL,
} from './taiyo.parser'
import type { TaiyoMeiliHit, TaiyoChapterSummary, TaiyoChapterDetail } from './taiyo.types'

describe('taiyo.parser', () => {
  describe('extractMediaTitle', () => {
    it('deve priorizar título em PT-BR', () => {
      const titles = [
        { title: 'Solo Leveling EN', language: 'EN' },
        { title: 'Solo Leveling PT', language: 'PT-BR' },
      ]
      expect(extractMediaTitle(titles)).toBe('Solo Leveling PT')
    })

    it('deve priorizar isMainTitle se não houver PT-BR', () => {
      const titles = [
        { title: 'DBGalaxyTouring', language: 'en', isMainTitle: false, priority: 2 },
        { title: 'Dragon Ball GT', language: 'en', isMainTitle: true, priority: 3 },
      ]
      expect(extractMediaTitle(titles)).toBe('Dragon Ball GT')
    })

    it('deve usar EN se não houver PT-BR nem isMainTitle', () => {
      const titles = [
        { title: 'Solo Leveling EN', language: 'EN' },
        { title: 'Solo Leveling JA', language: 'JA' },
      ]
      expect(extractMediaTitle(titles)).toBe('Solo Leveling EN')
    })

    it('deve usar o primeiro disponível se não houver PT-BR nem EN', () => {
      const titles = [{ title: 'Solo Leveling JA', language: 'JA' }]
      expect(extractMediaTitle(titles)).toBe('Solo Leveling JA')
    })

    it('deve retornar Manga Desconhecido para array vazio', () => {
      expect(extractMediaTitle([])).toBe('Manga Desconhecido')
    })
  })

  describe('buildCoverUrl', () => {
    it('deve montar a URL da capa com CDN', () => {
      const url = buildCoverUrl('media-123', 'cover-456')
      expect(url).toBe(`${TAIYO_CDN_URL}/medias/media-123/covers/cover-456.jpg`)
    })

    it('deve retornar null se coverId for nulo ou indefinido', () => {
      expect(buildCoverUrl('media-123', null)).toBeNull()
      expect(buildCoverUrl('media-123', undefined)).toBeNull()
    })
  })

  describe('parseTaiyoSearchResult', () => {
    it('deve formatar resultado da busca do Meilisearch', () => {
      const hit: TaiyoMeiliHit = {
        id: 'feebe69d-fc00-4c2c-aae0-cb0ef872c40c',
        titles: [{ title: 'Futari Solo Camp', language: 'PT-BR' }],
        mainCoverId: '1c283d61-5c71-4380-a998-e0c7dc098a27',
      }

      const parsed = parseTaiyoSearchResult(hit)
      expect(parsed).toEqual({
        title: 'Futari Solo Camp',
        url: `${TAIYO_BASE_URL}/media/feebe69d-fc00-4c2c-aae0-cb0ef872c40c`,
        coverUrl: `${TAIYO_CDN_URL}/medias/feebe69d-fc00-4c2c-aae0-cb0ef872c40c/covers/1c283d61-5c71-4380-a998-e0c7dc098a27.jpg`,
        author: null,
      })
    })
  })

  describe('mapTaiyoToInspectResponse', () => {
    it('deve mapear metadados e capítulos corretamente', () => {
      const media = {
        id: 'media-1',
        titles: [{ title: 'Obra Teste', language: 'PT-BR' }],
        synopsis: 'Sinopse da obra teste.',
        coverId: 'cover-1',
        genres: ['Ação', 'Aventura'],
        status: 'RELEASING',
      }
      const summaries: TaiyoChapterSummary[] = [
        { id: 'ch-2', number: 2, title: 'O Segundo' },
        { id: 'ch-1', number: 1, title: null },
      ]

      const inspected = mapTaiyoToInspectResponse(media, summaries, `${TAIYO_BASE_URL}/media/media-1`)
      expect(inspected.metadata.title).toBe('Obra Teste')
      expect(inspected.metadata.status).toBe('ongoing')
      expect(inspected.metadata.genres).toEqual(['Ação', 'Aventura'])
      expect(inspected.covers).toHaveLength(1)
      expect(inspected.chapters).toHaveLength(2)
      expect(inspected.chapters[0].number).toBe('1')
      expect(inspected.chapters[1].number).toBe('2')
    })

    it('deve deduplicar capítulos por número preservando versão em PT-BR', () => {
      const media = {
        id: 'media-1',
        titles: [{ title: 'Obra Teste', language: 'PT-BR' }],
        synopsis: 'Sinopse',
      }
      const summaries: TaiyoChapterSummary[] = [
        { id: 'ch-1-en', number: 1, title: 'Chapter 1 EN', language: 'en' },
        { id: 'ch-1-pt', number: 1, title: 'Capítulo 1 PT', language: 'pt-BR' },
        { id: 'ch-2-pt', number: 2, title: 'Capítulo 2 PT', language: 'pt-BR' },
      ]

      const inspected = mapTaiyoToInspectResponse(media, summaries, `${TAIYO_BASE_URL}/media/media-1`)
      expect(inspected.chapters).toHaveLength(2)
      expect(inspected.chapters[0].url).toBe('https://taiyo.moe/chapter/ch-1-pt')
      expect(inspected.chapters[0].title).toContain('Capítulo 1 PT')
    })
  })

  describe('parseTaiyoPages', () => {
    it('deve gerar URLs absolutas de páginas ordenadas', () => {
      const detail: TaiyoChapterDetail = {
        id: 'ch-123',
        number: 1,
        pages: [
          { id: 'p2', extension: 'png', pageNumber: 2 },
          { id: 'p1', extension: 'jpg', pageNumber: 1 },
        ],
      }

      const pages = parseTaiyoPages(detail, 'media-123')
      expect(pages).toEqual([
        `${TAIYO_CDN_URL}/medias/media-123/chapters/ch-123/p1.jpg`,
        `${TAIYO_CDN_URL}/medias/media-123/chapters/ch-123/p2.png`,
      ])
    })

    it('deve usar jpg como fallback quando extension não for fornecida', () => {
      const detail: TaiyoChapterDetail = {
        id: 'ch-123',
        number: 1,
        pages: [
          { id: 'p1' },
          { id: 'p2' },
        ],
      }

      const pages = parseTaiyoPages(detail, 'media-123')
      expect(pages).toEqual([
        `${TAIYO_CDN_URL}/medias/media-123/chapters/ch-123/p1.jpg`,
        `${TAIYO_CDN_URL}/medias/media-123/chapters/ch-123/p2.jpg`,
      ])
    })
  })
})
