import { describe, expect, it, vi, beforeEach } from 'vitest'
import { MangasBrasukaStrategy } from '../../providers/mangasbrasuka/mangasbrasuka.provider'
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
  id: 'wrk_1',
  slug: 'one-piece',
  title: 'One Piece',
  coverUrl: 'https://cdn.example.com/cover.webp',
  type: 'manga',
}

describe('MangasBrasukaStrategy', () => {
  let provider: MangasBrasukaStrategy

  beforeEach(() => {
    provider = new MangasBrasukaStrategy(fakeLimiter)
    mockGet.mockReset()
  })

  it('search mapeia itens da API para ProviderSearchResult', async () => {
    mockGet.mockResolvedValueOnce({ data: { data: [SEARCH_ITEM] } })
    const results = await provider.search('one piece', { limit: 10 })
    expect(results).toEqual([
      {
        providerSlug: 'mangasbrasuka',
        title: 'One Piece',
        url: 'https://mangasbrasuka.com.br/manga/one-piece/',
        coverUrl: 'https://cdn.example.com/cover.webp',
        author: null,
        type: 'manga',
        genres: null,
      },
    ])
    expect(mockGet).toHaveBeenCalledWith(
      expect.stringContaining('/v1/www/search?q=one%20piece&limit=10'),
      expect.anything(),
    )
  })

  it('search propaga erro de rede', async () => {
    mockGet.mockRejectedValueOnce(new Error('boom'))
    await expect(provider.search('one piece')).rejects.toThrow(ScrapingNetworkError)
  })

  it('retorna array vazio para offset > 0', async () => {
    const results = await provider.search('one piece', { offset: 10 })
    expect(results).toEqual([])
    expect(mockGet).not.toHaveBeenCalled()
  })
})
