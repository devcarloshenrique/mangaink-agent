import { describe, expect, it, vi, beforeEach } from 'vitest'
import * as cheerio from 'cheerio'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { MangaLivreStrategy } from '../../providers/mangalivre/mangalivre.provider'
import { parseSearchResults } from '../../providers/mangalivre/mangalivre.parser'
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

const here = dirname(fileURLToPath(import.meta.url))
const fixturePath = join(
  here,
  '..',
  '..',
  'providers',
  'mangalivre',
  '__fixtures__',
  'search-one-piece.html',
)

function loadFixture(): string {
  return readFileSync(fixturePath, 'utf-8')
}

describe('MangaLivre parseSearchResults (fixture)', () => {
  it('extrai title/url/cover com sufixo -WxH removido', () => {
    const $ = cheerio.load(loadFixture())
    const results = parseSearchResults($, 'https://mangalivre.to')
    expect(results.length).toBeGreaterThan(0)
    const first = results.find((r) => r.url === 'https://mangalivre.to/manga/one-piece-ptbr/')
    expect(first).toBeDefined()
    expect(first?.title).toBe('One Piece')
    expect(first?.coverUrl).toBe(
      'https://mangalivre.to/wp-content/uploads/2025/07/One-Piece-Manga-Livre.webp',
    )
    for (const r of results) {
      expect(r.url).toMatch(/mangalivre\.to\/manga\//)
      expect(r.coverUrl ?? '').not.toMatch(/-\d+x\d+\./)
    }
  })

  it('descarta links fora do padrão /manga/', () => {
    const $ = cheerio.load(
      '<div class="row c-tabs-item__content"><div class="post-title"><h3 class="h4"><a href="https://mangalivre.to/genero/acao/">Ação</a></h3></div></div>',
    )
    expect(parseSearchResults($, 'https://mangalivre.to')).toEqual([])
  })
})

describe('MangaLivreStrategy.search', () => {
  let provider: MangaLivreStrategy

  beforeEach(() => {
    provider = new MangaLivreStrategy(fakeLimiter)
    mockGet.mockReset()
  })

  it('busca via ?s=&post_type=wp-manga e retorna resultados', async () => {
    mockGet.mockResolvedValueOnce({ data: loadFixture() })
    const results = await provider.search('one piece', { limit: 10 })
    expect(results.length).toBeGreaterThan(0)
    expect(mockGet).toHaveBeenCalledWith(
      expect.stringContaining('?s=one%20piece&post_type=wp-manga'),
      expect.anything(),
    )
    expect(results[0]).toMatchObject({ providerSlug: 'mangalivre' })
  })

  it('propaga erro de rede', async () => {
    mockGet.mockRejectedValueOnce(new Error('boom'))
    await expect(provider.search('one piece')).rejects.toThrow(ScrapingNetworkError)
  })

  it('retorna array vazio para offset > 0', async () => {
    const results = await provider.search('one piece', { offset: 10 })
    expect(results).toEqual([])
    expect(mockGet).not.toHaveBeenCalled()
  })
})
