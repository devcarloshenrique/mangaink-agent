import type { Prisma, Provider } from '@prisma/client'
import { getPrisma } from '../../../shared/database/prisma'
import type { ProviderEngine } from '../types/provider.types'
import type {
  ProviderRecord,
  ProviderSeed,
  ProviderUpdate,
} from '../providers/known-providers.types'
import type { ProviderRepository } from './provider.repository'

const ENGINE_WHITELIST: ReadonlySet<string> = new Set(['api', 'cheerio', 'playwright'])

/** Converte a linha do Prisma no tipo de domínio, normalizando o engine. */
function toProviderRecord(row: Provider): ProviderRecord {
  return {
    ...row,
    engine: (ENGINE_WHITELIST.has(row.engine) ? row.engine : 'cheerio') as ProviderEngine,
  }
}

/** Monta o objeto de create com defaults aplicados. */
function toCreateData(seed: ProviderSeed): Prisma.ProviderCreateInput {
  return {
    slug: seed.slug,
    name: seed.name,
    engine: seed.engine,
    tags: seed.tags ?? [],
    status: seed.status ?? 'active',
    description: seed.description ?? null,
    urlExample: seed.urlExample ?? null,
    homepage: seed.homepage ?? null,
    searchUrl: seed.searchUrl ?? null,
    rateLimitMaxConcurrent: seed.rateLimitMaxConcurrent ?? 6,
    rateLimitMinTime: seed.rateLimitMinTime ?? 50,
    rateLimitReservoir: seed.rateLimitReservoir ?? null,
    rateLimitReservoirRefreshInterval: seed.rateLimitReservoirRefreshInterval ?? null,
  }
}

/**
 * Monta o objeto de update do upsert: apenas campos vindos do código e que NÃO
 * são editáveis pelo admin (name/engine). Campos de display/rate limit
 * (tags, status, description, urlExample, homepage, searchUrl,
 * rate limits) são editáveis via PATCH e NÃO devem ser revertidos pelo seed a
 * cada boot — o seed só cria providers ausentes (decisão MEC-31 revisada).
 */
function toUpdateData(seed: ProviderSeed): Prisma.ProviderUpdateInput {
  return {
    name: seed.name,
    engine: seed.engine,
  }
}

export class PrismaProviderRepository implements ProviderRepository {
  async findAll(): Promise<ProviderRecord[]> {
    const rows = await getPrisma().provider.findMany({
      orderBy: { name: 'asc' },
    })
    return rows.map(toProviderRecord)
  }

  async findBySlug(slug: string): Promise<ProviderRecord | null> {
    const row = await getPrisma().provider.findUnique({
      where: { slug },
    })
    return row ? toProviderRecord(row) : null
  }

  async upsertFromSeed(seeds: ProviderSeed[]): Promise<void> {
    if (seeds.length === 0) return

    await getPrisma().$transaction(
      seeds.map((seed) => {
        return getPrisma().provider.upsert({
          where: { slug: seed.slug },
          create: toCreateData(seed),
          update: toUpdateData(seed),
        })
      }),
      { timeout: 30_000, maxWait: 10_000 },
    )
  }

  async update(slug: string, data: ProviderUpdate): Promise<ProviderRecord | null> {
    const existing = await getPrisma().provider.findUnique({
      where: { slug },
      select: { slug: true },
    })
    if (!existing) return null

    const row = await getPrisma().provider.update({
      where: { slug },
      data,
    })
    return toProviderRecord(row)
  }
}
