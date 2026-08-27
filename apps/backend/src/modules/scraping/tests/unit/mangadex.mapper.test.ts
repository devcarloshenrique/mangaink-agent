import { describe, it, expect } from 'vitest'
import {
  extractMangaId,
  extractChapterId,
  resolveStatus,
  normalizeChapterNumber,
  mapMangaToInspectResponse,
  mapAtHomeToImageUrls,
} from '../../providers/mangadex/mangadex.mapper'
import type {
  MangaDexMangaData,
  MangaDexChapterData,
  MangaDexAtHomeResponse,
} from '../../providers/mangadex/mangadex.types'

describe('MangaDex Mapper', () => {
  it('extracts manga ID from full URL', () => {
    const url = 'https://mangadex.org/title/183b5c1e-5bfd-4f7f-9b21-3ac88c584987/chi-chikyuu-no-undou-ni-tsuite'
    expect(extractMangaId(url)).toBe('183b5c1e-5bfd-4f7f-9b21-3ac88c584987')
  })

  it('extracts chapter ID from chapter URL', () => {
    const url = 'https://mangadex.org/chapter/b29b7415-ebbd-4e5d-bb40-e9757f2a3bac'
    expect(extractChapterId(url)).toBe('b29b7415-ebbd-4e5d-bb40-e9757f2a3bac')
  })

  it('normalizes statuses correctly', () => {
    expect(resolveStatus('ongoing')).toBe('ongoing')
    expect(resolveStatus('completed')).toBe('completed')
    expect(resolveStatus('hiatus')).toBe('hiatus')
    expect(resolveStatus('cancelled')).toBe('cancelled')
    expect(resolveStatus('other')).toBe('unknown')
  })

  it('normalizes chapter numbers', () => {
    expect(normalizeChapterNumber('1')).toBe('1')
    expect(normalizeChapterNumber('12.0')).toBe('12')
    expect(normalizeChapterNumber('12.5')).toBe('12.5')
    expect(normalizeChapterNumber(null)).toBe('0')
  })

  it('maps manga and chapters to SourceInspectResponse', () => {
    const manga: MangaDexMangaData = {
      id: '183b5c1e-5bfd-4f7f-9b21-3ac88c584987',
      type: 'manga',
      attributes: {
        title: { 'ja-ro': 'Chi. Chikyuu no Undou ni Tsuite' },
        altTitles: [{ 'pt-br': 'Sobre os Movimentos da Terra' }],
        description: { 'pt-br': 'História sobre a teoria heliocêntrica.' },
        status: 'completed',
        tags: [
          {
            id: 'tag-1',
            type: 'tag',
            attributes: { name: { en: 'Historical' } },
          },
        ],
      },
      relationships: [
        {
          id: 'author-1',
          type: 'author',
          attributes: { name: 'Uoto' },
        },
        {
          id: 'cover-1',
          type: 'cover_art',
          attributes: { fileName: 'cover.jpg' },
        },
      ],
    }

    const chapters: MangaDexChapterData[] = [
      {
        id: 'chap-1',
        type: 'chapter',
        attributes: {
          volume: '1',
          chapter: '1',
          title: 'Capítulo 1',
          translatedLanguage: 'pt-br',
          externalUrl: null,
          publishAt: '2021-01-01',
          readableAt: '2021-01-01',
          createdAt: '2021-01-01',
          updatedAt: '2021-01-01',
          pages: 40,
          version: 1,
        },
        relationships: [],
      },
    ]

    const res = mapMangaToInspectResponse(
      manga,
      chapters,
      'https://mangadex.org/title/183b5c1e-5bfd-4f7f-9b21-3ac88c584987',
    )

    expect(res.status).toBe('ready')
    expect(res.provider.slug).toBe('mangadex')
    expect(res.metadata.title).toBe('Chi. Chikyuu no Undou ni Tsuite')
    expect(res.metadata.author).toBe('Uoto')
    expect(res.metadata.description).toBe('História sobre a teoria heliocêntrica.')
    expect(res.metadata.genres).toContain('Historical')
    expect(res.chapters).toHaveLength(1)
    expect(res.chapters[0].number).toBe('1')
    expect(res.covers).toHaveLength(1)
    expect(res.covers[0].imageUrl).toContain('covers/183b5c1e-5bfd-4f7f-9b21-3ac88c584987/cover.jpg')
  })

  it('maps At-Home response to page image URLs', () => {
    const atHome: MangaDexAtHomeResponse = {
      result: 'ok',
      baseUrl: 'https://cmdxd98sb0x3yprd.mangadex.network',
      chapter: {
        hash: 'hash123',
        data: ['page1.jpg', 'page2.jpg'],
        dataSaver: [],
      },
    }

    const urls = mapAtHomeToImageUrls(atHome)
    expect(urls).toEqual([
      'https://cmdxd98sb0x3yprd.mangadex.network/data/hash123/page1.jpg',
      'https://cmdxd98sb0x3yprd.mangadex.network/data/hash123/page2.jpg',
    ])
  })
})
