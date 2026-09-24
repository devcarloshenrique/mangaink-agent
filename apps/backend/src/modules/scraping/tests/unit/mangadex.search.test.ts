import { describe, expect, it, vi, beforeEach } from 'vitest'
import { MangaDexStrategy } from '../../providers/mangadex/mangadex.provider'
import { ScrapingNetworkError } from '../../errors/scraping.errors'
import type { RateLimiter } from '../../rate-limit/types'

const mockGet = vi.hoisted(() => vi.fn())

vi.mock('../../../../shared/http/http-client', () => ({
  createHttpClient: vi.fn(() => ({
    get: mockGet,
  })),
}))

const fakeLimiter: RateLimiter = {
  schedule: (fn: () => Promise<unknown>) => fn(),
} as unknown as RateLimiter

const SEARCH_ITEM = {
  id: 'manga-id-1',
  type: 'manga',
  attributes: {
    title: { en: 'One Piece' },
    altTitles: [],
    description: {},
    status: 'ongoing',
  },
  relationships: [
    { id: 'cover-1', type: 'cover_art', attributes: { fileName: 'cover.jpg' } },
    { id: 'author-1', type: 'author', attributes: { name: 'Eiichiro Oda' } },
  ],
}

describe('MangaDexStrategy.search', () => {
  let provider: MangaDexStrategy

  beforeEach(() => {
    provider = new MangaDexStrategy(fakeLimiter)
    mockGet.mockReset()
  })

  it('mapeia itens da API para ProviderSearchResult', async () => {
    mockGet.mockResolvedValueOnce({ data: { result: 'ok', data: [SEARCH_ITEM] } })
    const results = await provider.search('one piece', { limit: 5 })
    expect(results).toEqual([
      {
        providerSlug: 'mangadex',
        title: 'One Piece',
        url: 'https://mangadex.org/title/manga-id-1',
        coverUrl: 'https://uploads.mangadex.org/covers/manga-id-1/cover.jpg',
        author: 'Eiichiro Oda',
        type: null,
        genres: null,
      },
    ])
    expect(mockGet).toHaveBeenCalledWith(
      expect.stringContaining('/manga?title=one%20piece'),
      expect.anything(),
    )
  })

  it('mapeia originalLanguage para type e tags para genres', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        result: 'ok',
        data: [
          {
            ...SEARCH_ITEM,
            attributes: {
              ...SEARCH_ITEM.attributes,
              originalLanguage: 'ja',
              tags: [
                { id: 't1', type: 'tag', attributes: { name: { en: 'Action' } } },
                { id: 't2', type: 'tag', attributes: { name: { en: 'Adventure' } } },
              ],
            },
          },
        ],
      },
    })
    const results = await provider.search('one piece', { limit: 5 })
    expect(results[0]?.type).toBe('manga')
    expect(results[0]?.genres).toEqual(['Action', 'Adventure'])
  })

  it('propaga erro de rede', async () => {
    mockGet.mockRejectedValueOnce(new Error('boom'))
    await expect(provider.search('one piece')).rejects.toThrow(ScrapingNetworkError)
  })

  it('inclui limit e offset na URL da API', async () => {
    mockGet.mockResolvedValueOnce({
      data: { data: [SEARCH_ITEM] },
    })
    await provider.search('one piece', { limit: 10, offset: 20 })
    expect(mockGet).toHaveBeenCalledWith(
      expect.stringContaining('limit=10&offset=20'),
      expect.anything(),
    )
  })

  it('filtra por availableTranslatedLanguage[]=pt-br quando language=pt-br', async () => {
    mockGet.mockResolvedValueOnce({
      data: { data: [SEARCH_ITEM] },
    })
    await provider.search('one piece', { language: 'pt-br' })
    expect(mockGet).toHaveBeenCalledWith(
      expect.stringContaining('availableTranslatedLanguage[]=pt-br&availableTranslatedLanguage[]=pt'),
      expect.anything(),
    )
  })

  it('filtra por availableTranslatedLanguage[]=en quando language=en e prioriza title.en', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        data: [
          {
            ...SEARCH_ITEM,
            attributes: {
              ...SEARCH_ITEM.attributes,
              title: { 'pt-br': 'Uma Pedaço', en: 'One Piece' },
            },
          },
        ],
      },
    })
    const results = await provider.search('one piece', { language: 'en' })
    expect(mockGet).toHaveBeenCalledWith(
      expect.stringContaining('availableTranslatedLanguage[]=en'),
      expect.anything(),
    )
    expect(results[0]?.title).toBe('One Piece')
    expect(results[0]?.url).toBe('https://mangadex.org/title/manga-id-1?lang=en')
  })

  it('não passa availableTranslatedLanguage quando language=all', async () => {
    mockGet.mockResolvedValueOnce({
      data: { data: [SEARCH_ITEM] },
    })
    await provider.search('one piece', { language: 'all' })
    expect(mockGet).toHaveBeenCalledWith(
      expect.not.stringContaining('availableTranslatedLanguage'),
      expect.anything(),
    )
  })
})
