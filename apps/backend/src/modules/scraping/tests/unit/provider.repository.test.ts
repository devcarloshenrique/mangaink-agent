import { describe, expect, it, beforeEach } from 'vitest'
import { getPrisma } from '../../../../shared/database/prisma'
import { PrismaProviderRepository } from '../../repositories/prisma-provider.repository'
import type { ProviderSeed } from '../../providers/known-providers.types'

const SEED: ProviderSeed[] = [
  {
    slug: 'mangalivre',
    name: 'Manga Livre',
    engine: 'cheerio',
    tags: ['mangá', 'português'],
    status: 'active',
    rateLimitMaxConcurrent: 8,
    rateLimitMinTime: 0,
  },
  {
    slug: 'imperiodabritannia',
    name: 'Imperio da Britannia',
    engine: 'api',
    tags: ['mangá', 'api'],
    status: 'active',
    rateLimitMaxConcurrent: 2,
    rateLimitMinTime: 500,
    rateLimitReservoir: 10,
    rateLimitReservoirRefreshInterval: 1000,
  },
]

describe('PrismaProviderRepository', () => {
  let repository: PrismaProviderRepository

  beforeEach(async () => {
    await getPrisma().provider.deleteMany()
    repository = new PrismaProviderRepository()
  })

  it('findAll retorna providers persistidos', async () => {
    await repository.upsertFromSeed(SEED)

    const all = await repository.findAll()
    // findAll ordena por name asc: "Imperio da Britannia" < "Manga Livre"
    expect(all.map((p) => p.slug)).toEqual(['imperiodabritannia', 'mangalivre'])
    const mangalivre = all.find((p) => p.slug === 'mangalivre')
    expect(mangalivre?.engine).toBe('cheerio')
    expect(mangalivre?.rateLimitMaxConcurrent).toBe(8)
  })

  it('findBySlug retorna provider ou null', async () => {
    await repository.upsertFromSeed(SEED)

    const found = await repository.findBySlug('mangalivre')
    expect(found).not.toBeNull()
    expect(found?.name).toBe('Manga Livre')
    expect(found?.tags).toContain('português')

    const missing = await repository.findBySlug('nao-existe')
    expect(missing).toBeNull()
  })

  it('upsertFromSeed insere providers ausentes', async () => {
    await repository.upsertFromSeed(SEED)

    const all = await repository.findAll()
    expect(all).toHaveLength(2)
    const imperio = all.find((p) => p.slug === 'imperiodabritannia')
    expect(imperio?.rateLimitReservoir).toBe(10)
    expect(imperio?.rateLimitReservoirRefreshInterval).toBe(1000)
  })

  it('upsertFromSeed atualiza apenas campos de código em provider existente (não reverte rate limits)', async () => {
    await repository.upsertFromSeed(SEED)
    await repository.upsertFromSeed([
      { ...SEED[0], rateLimitMaxConcurrent: 9, rateLimitMinTime: 100 },
    ])

    const all = await repository.findAll()
    expect(all).toHaveLength(2)
    const mangalivre = await repository.findBySlug('mangalivre')
    // rate limits persistidos NÃO são revertidos pelo re-seed
    expect(mangalivre?.rateLimitMaxConcurrent).toBe(8)
    expect(mangalivre?.rateLimitMinTime).toBe(0)
    // campos de código (name/engine) seguem o seed
    expect(mangalivre?.name).toBe('Manga Livre')
    expect(mangalivre?.engine).toBe('cheerio')
  })

  it('upsertFromSeed mantém edições do admin (description/status/tags) feitas via update()', async () => {
    await repository.upsertFromSeed(SEED)
    await repository.update('mangalivre', {
      description: 'Editado pelo admin',
      status: 'slow',
      tags: ['custom'],
    })

    await repository.upsertFromSeed(SEED)

    const reloaded = await repository.findBySlug('mangalivre')
    expect(reloaded?.description).toBe('Editado pelo admin')
    expect(reloaded?.status).toBe('slow')
    expect(reloaded?.tags).toEqual(['custom'])
    expect(reloaded?.rateLimitMaxConcurrent).toBe(8)
  })

  it('update aplica campos parciais', async () => {
    await repository.upsertFromSeed(SEED)

    const updated = await repository.update('mangalivre', {
      description: 'Novo descricao',
      rateLimitMaxConcurrent: 5,
    })
    expect(updated).not.toBeNull()
    expect(updated?.description).toBe('Novo descricao')
    expect(updated?.rateLimitMaxConcurrent).toBe(5)

    const reloaded = await repository.findBySlug('mangalivre')
    expect(reloaded?.description).toBe('Novo descricao')
  })

  it('update retorna null para slug inexistente', async () => {
    const result = await repository.update('nao-existe', { description: 'x' })
    expect(result).toBeNull()
  })
})
