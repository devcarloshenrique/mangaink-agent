import { describe, expect, it, vi, beforeEach } from 'vitest'
import { ImperioDaBritanniaStrategy } from '../../providers/imperiodabritannia/imperiodabritannia.provider'
import { ScrapingNetworkError } from '../../errors/scraping.errors'
import type { RateLimiter } from '../../rate-limit/types'

const mockGet = vi.hoisted(() => vi.fn())

vi.mock('../../../../shared/http/http-client', () => ({
  createHttpClient: vi.fn(() => ({
    get: mockGet,
  })),
}))

vi.mock('../../../../shared/config/env', () => ({
  env: { X_API_TOKEN: 'test-token' },
}))

const fakeLimiter: RateLimiter = {
  schedule: (fn: () => Promise<unknown>) => fn(),
} as unknown as RateLimiter

const SEARCH_OBRA = {
  id: 2691,
  nome: 'Um Fuzileiro Espacial',
  imagem: 'obras/2691/cover.webp',
  slug: 'um-fuzileiro-espacial',
}

describe('ImperioDaBritanniaStrategy.search', () => {
  let provider: ImperioDaBritanniaStrategy

  beforeEach(() => {
    provider = new ImperioDaBritanniaStrategy(fakeLimiter)
    mockGet.mockReset()
  })

  it('usa o param busca e mapeia slug/imagem', async () => {
    mockGet.mockResolvedValueOnce({
      data: { sucesso: true, obras: [SEARCH_OBRA], pagination: { total: 1 } },
    })
    const results = await provider.search('fuzileiro', { limit: 5 })
    expect(results).toEqual([
      {
        providerSlug: 'imperiodabritannia',
        title: 'Um Fuzileiro Espacial',
        url: 'https://imperiodabritannia.net/manga/um-fuzileiro-espacial/',
        coverUrl: 'https://cdn.imperiodabritannia.net/obras/2691/cover.webp',
        author: null,
      },
    ])
    expect(mockGet).toHaveBeenCalledWith(
      expect.stringContaining('/api/obras?busca=fuzileiro'),
      expect.anything(),
    )
  })

  it('faz hydrate via detalhe quando o item não traz slug', async () => {
    mockGet
      .mockResolvedValueOnce({
        data: { sucesso: true, obras: [{ id: 1, nome: 'Solo', imagem: null }] },
      })
      .mockResolvedValueOnce({
        data: { sucesso: true, obra: { id: 1, nome: 'Solo', slug: 'solo-leveling' } },
      })
    const results = await provider.search('solo')
    expect(results).toEqual([
      {
        providerSlug: 'imperiodabritannia',
        title: 'Solo',
        url: 'https://imperiodabritannia.net/manga/solo-leveling/',
        coverUrl: null,
        author: null,
      },
    ])
  })

  it('lança erro visível quando toda a hidratação falha', async () => {
    mockGet
      .mockResolvedValueOnce({
        data: { sucesso: true, obras: [{ id: 2, nome: 'X', imagem: null }] },
      })
      .mockRejectedValueOnce(new Error('404'))
    await expect(provider.search('xablau')).rejects.toThrow(ScrapingNetworkError)
  })

  it('retorna o parcial quando só parte da hidratação falha', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/api/obras?busca=')) {
        return Promise.resolve({
          data: {
            sucesso: true,
            obras: [
              { id: 1, nome: 'Solo', imagem: null },
              { id: 2, nome: 'Quebrado', imagem: null },
            ],
          },
        })
      }
      if (url.endsWith('/api/obras/1')) {
        return Promise.resolve({
          data: { sucesso: true, obra: { id: 1, nome: 'Solo', slug: 'solo-leveling' } },
        })
      }
      return Promise.reject(new Error('404'))
    })
    const results = await provider.search('solo')
    expect(results).toEqual([
      {
        providerSlug: 'imperiodabritannia',
        title: 'Solo',
        url: 'https://imperiodabritannia.net/manga/solo-leveling/',
        coverUrl: null,
        author: null,
      },
    ])
  })

  it('propaga erro de rede da listagem', async () => {
    mockGet.mockRejectedValueOnce(new Error('boom'))
    await expect(provider.search('solo')).rejects.toThrow(ScrapingNetworkError)
  })

  it('calcula pagina a partir do offset', async () => {
    mockGet.mockResolvedValueOnce({
      data: { sucesso: true, obras: [SEARCH_OBRA], pagination: { total: 1 } },
    })
    await provider.search('fuzileiro', { limit: 10, offset: 20 })
    expect(mockGet).toHaveBeenCalledWith(
      expect.stringContaining('limite=10&pagina=3'),
      expect.anything(),
    )
  })
})
