import { describe, it, expect, vi } from 'vitest'
import { ListProvidersUseCase } from '../../use-cases/list-providers.use-case'
import { KNOWN_PROVIDERS } from '../../providers/known-providers'
import type { ProviderRepository } from '../../repositories/provider.repository'

function makeRecord(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: '1',
    slug: 'mangalivre',
    name: 'Manga Livre',
    engine: 'cheerio',
    tags: ['mangá', 'português'],
    status: 'active',
    description: 'Acervo de mangás',
    urlExample: null,
    homepage: null,
    searchUrl: null,
    rateLimitMaxConcurrent: 2,
    rateLimitMinTime: 250,
    rateLimitReservoir: null,
    rateLimitReservoirRefreshInterval: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...over,
  }
}

describe('ListProvidersUseCase', () => {
  it('deve listar providers do banco no shape público (sem allowedDomains)', async () => {
    const repository = {
      findAll: vi.fn().mockResolvedValue([makeRecord()]),
    } as unknown as ProviderRepository

    const useCase = new ListProvidersUseCase(repository)
    const result = await useCase.execute()

    expect(repository.findAll).toHaveBeenCalledTimes(1)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      slug: 'mangalivre',
      name: 'Manga Livre',
      engine: 'cheerio',
      status: 'active',
      tags: ['mangá', 'português'],
      description: 'Acervo de mangás',
      rateLimit: { maxConcurrent: 2, minTime: 250, reservoir: null, reservoirRefreshInterval: null },
    })
    expect(result[0]).not.toHaveProperty('allowedDomains')
  })

  it('deve fazer fallback para known-providers.ts quando o banco falhar', async () => {
    const repository = {
      findAll: vi.fn().mockRejectedValue(new Error('connection refused')),
    } as unknown as ProviderRepository

    const useCase = new ListProvidersUseCase(repository)
    const result = await useCase.execute()

    expect(result.length).toBe(KNOWN_PROVIDERS.length)
    expect(result.map((p) => p.slug)).toEqual(KNOWN_PROVIDERS.map((p) => p.slug))
    expect(result[0]).not.toHaveProperty('allowedDomains')
  })
})
