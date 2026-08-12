import { describe, it, expect, vi } from 'vitest'
import { UpdateProviderUseCase } from '../../use-cases/update-provider.use-case'
import { ProviderBySlugNotFoundError } from '../../errors/scraping.errors'
import { updateProviderBodySchema } from '../../dtos/provider.dto'
import type { ProviderRepository } from '../../repositories/provider.repository'

function makeRecord(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: '1',
    slug: 'mangalivre',
    name: 'Manga Livre',
    engine: 'cheerio',
    tags: ['mangá'],
    status: 'active',
    description: null,
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

describe('UpdateProviderUseCase', () => {
  it('deve achatar rateLimit, salvar, propagar config e retornar o provider atualizado', async () => {
    const updated = makeRecord({
      slug: 'mangalivre',
      status: 'slow',
      description: 'Em manutenção',
      rateLimitMaxConcurrent: 1,
      rateLimitMinTime: 500,
    })
    const repository = { update: vi.fn().mockResolvedValue(updated) } as unknown as ProviderRepository
    const resolver = { updateRateLimit: vi.fn() }

    const useCase = new UpdateProviderUseCase(repository, resolver as never)
    const result = await useCase.execute('mangalivre', {
      status: 'slow',
      description: 'Em manutenção',
      rateLimit: { maxConcurrent: 1, minTime: 500 },
    })

    expect(repository.update).toHaveBeenCalledWith('mangalivre', {
      status: 'slow',
      description: 'Em manutenção',
      rateLimitMaxConcurrent: 1,
      rateLimitMinTime: 500,
    })
    expect(resolver.updateRateLimit).toHaveBeenCalledWith({
      slug: 'mangalivre',
      maxConcurrent: 1,
      minTime: 500,
      reservoir: undefined,
      reservoirRefreshInterval: undefined,
    })
    expect(result.slug).toBe('mangalivre')
    expect(result.status).toBe('slow')
    expect(result.description).toBe('Em manutenção')
    expect(result.rateLimit).toEqual({ maxConcurrent: 1, minTime: 500, reservoir: null, reservoirRefreshInterval: null })
  })

  it('deve propagar reservoir/reservoirRefreshInterval quando presentes', async () => {
    const updated = makeRecord({
      slug: 'mangalivre',
      rateLimitReservoir: 100,
      rateLimitReservoirRefreshInterval: 60_000,
    })
    const repository = { update: vi.fn().mockResolvedValue(updated) } as unknown as ProviderRepository
    const resolver = { updateRateLimit: vi.fn() }

    const useCase = new UpdateProviderUseCase(repository, resolver as never)
    await useCase.execute('mangalivre', {
      rateLimit: { reservoir: 100, reservoirRefreshInterval: 60_000 },
    })

    expect(resolver.updateRateLimit).toHaveBeenCalledWith({
      slug: 'mangalivre',
      maxConcurrent: 2,
      minTime: 250,
      reservoir: 100,
      reservoirRefreshInterval: 60_000,
    })
  })

  it('deve lançar ProviderBySlugNotFoundError quando o slug não existe', async () => {
    const repository = { update: vi.fn().mockResolvedValue(null) } as unknown as ProviderRepository
    const resolver = { updateRateLimit: vi.fn() }

    const useCase = new UpdateProviderUseCase(repository, resolver as never)
    await expect(useCase.execute('nao-existe', { status: 'slow' })).rejects.toBeInstanceOf(
      ProviderBySlugNotFoundError,
    )
    expect(resolver.updateRateLimit).not.toHaveBeenCalled()
  })

  describe('validação Zod do body (updateProviderBodySchema)', () => {
    it('aceita rateLimit com maxConcurrent >= 1 e minTime >= 0', () => {
      const parsed = updateProviderBodySchema.safeParse({
        status: 'slow',
        rateLimit: { maxConcurrent: 1, minTime: 0 },
      })
      expect(parsed.success).toBe(true)
      expect(parsed.data?.rateLimit).toEqual({ maxConcurrent: 1, minTime: 0 })
    })

    it('rejeita maxConcurrent < 1', () => {
      const parsed = updateProviderBodySchema.safeParse({
        rateLimit: { maxConcurrent: 0, minTime: 100 },
      })
      expect(parsed.success).toBe(false)
    })

    it('rejeita maxConcurrent fracionário', () => {
      const parsed = updateProviderBodySchema.safeParse({
        rateLimit: { maxConcurrent: 1.5, minTime: 100 },
      })
      expect(parsed.success).toBe(false)
    })

    it('rejeita minTime < 0', () => {
      const parsed = updateProviderBodySchema.safeParse({
        rateLimit: { maxConcurrent: 2, minTime: -1 },
      })
      expect(parsed.success).toBe(false)
    })

    it('rejeita reservoir < 1 e reservoirRefreshInterval < 100', () => {
      const badReservoir = updateProviderBodySchema.safeParse({
        rateLimit: { reservoir: 0 },
      })
      const badInterval = updateProviderBodySchema.safeParse({
        rateLimit: { reservoirRefreshInterval: 99 },
      })
      expect(badReservoir.success).toBe(false)
      expect(badInterval.success).toBe(false)
    })
  })
})
