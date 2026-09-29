import Bottleneck from 'bottleneck'
import { getProviderResolver } from '../utils/resolve-provider'
import { getProviderRepository } from '../../../shared/database/repositories'
import type { IProviderStrategy } from '../interfaces/provider-strategy.interface'
import type { ProviderSearchResult } from '../types/provider.types'
import type { ProviderRepository } from '../repositories/provider.repository'
import { MAX_EXPLICIT_PROVIDERS } from '../dtos/search-sources.dto'
import {
  ScrapingError,
  ScrapingNetworkError,
  ScrapingParseError,
} from '../errors/scraping.errors'

export const DEFAULT_MAX_PROVIDERS = 10
// Re-exportado por compatibilidade — a fonte da verdade vive no DTO.
export { MAX_EXPLICIT_PROVIDERS }
export const GLOBAL_MAX_CONCURRENT = 6
export const DEFAULT_TIMEOUT_MS = 12000
export const SEARCH_CACHE_TTL_MS = 5 * 60_000
export const SEARCH_CACHE_MAX_ENTRIES = 200
const DEFAULT_LIMIT_PER_PROVIDER = 10

export const HOTLINK_PROTECTED_PROVIDERS = new Set(['mangakakalot', 'mangapill'])

export function buildCoverProxyUrl(rawCoverUrl: string, providerSlug: string): string {
  return `/api/conversions/source/cover-proxy?url=${encodeURIComponent(rawCoverUrl)}&provider=${encodeURIComponent(providerSlug)}`
}

const SEARCHABLE_STATUSES = new Set(['active', 'slow', 'beta'])

export interface SearchSourcesArgs {
  query: string
  providers?: string[]
  limitPerProvider?: number
  offsetPerProvider?: number
  timeoutMs?: number
  maxProviders?: number
  language?: string
}

export interface SearchSourcesResult {
  query: string
  results: ProviderSearchResult[]
  errors: Array<{ providerSlug: string; message: string }>
  searchedProviders: string[]
  truncated: boolean
}

interface CacheEntry {
  expiresAt: number
  payload: SearchSourcesResult
}

const cache = new Map<string, CacheEntry>()
const inFlight = new Map<string, Promise<SearchSourcesResult>>()

const globalSearchLimiter = new Bottleneck({ maxConcurrent: GLOBAL_MAX_CONCURRENT })

function buildCacheKey(
  query: string,
  searchedProviders: string[],
  limit: number,
  language?: string,
): string {
  return `${query.trim().toLowerCase()}|${searchedProviders.join(',')}|${limit}|${language ?? ''}`
}

function pruneCache(): void {
  const now = Date.now()
  for (const [key, entry] of cache) {
    if (entry.expiresAt <= now) cache.delete(key)
  }
  while (cache.size > SEARCH_CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next()
    if (oldest.done) break
    cache.delete(oldest.value)
  }
}

function cloneResult(result: SearchSourcesResult): SearchSourcesResult {
  return {
    query: result.query,
    results: result.results.map((r) => ({ ...r })),
    errors: result.errors.map((e) => ({ ...e })),
    searchedProviders: [...result.searchedProviders],
    truncated: result.truncated,
  }
}

/** Limpa cache + singleflight (uso exclusivo em testes). */
export function __resetSearchCacheForTests(): void {
  cache.clear()
  inFlight.clear()
}

/**
 * Slug explícito sem strategy viva. Carrega `statusCode = 400` para o
 * error handler global (`shared/server.ts`) responder 400 com `{ error }`,
 * no mesmo shape da validação Zod da rota.
 */
export class UnknownProviderError extends ScrapingError {
  readonly statusCode = 400

  constructor(slugs: string[]) {
    super(`Provider desconhecido: ${slugs.join(', ')}`, 'UNKNOWN_PROVIDER')
    this.name = 'UnknownProviderError'
  }
}

export class SearchSourcesUseCase {
  private readonly repository: ProviderRepository
  private readonly listStrategies: () => IProviderStrategy[]

  constructor(
    repository?: ProviderRepository,
    listStrategies?: () => IProviderStrategy[],
  ) {
    this.repository = repository ?? getProviderRepository()
    this.listStrategies = listStrategies ?? (() => getProviderResolver().listAll())
  }

  async execute(args: SearchSourcesArgs): Promise<SearchSourcesResult> {
    const query = args.query.trim()
    const limit = args.limitPerProvider ?? DEFAULT_LIMIT_PER_PROVIDER
    const offset = Math.max(0, args.offsetPerProvider ?? 0)
    const timeoutMs = args.timeoutMs ?? DEFAULT_TIMEOUT_MS
    const useCache =
      limit === DEFAULT_LIMIT_PER_PROVIDER &&
      timeoutMs === DEFAULT_TIMEOUT_MS &&
      offset === 0

    const strategies = this.listStrategies()
    const bySlug = new Map(strategies.map((s) => [s.slug, s]))

    let targets: IProviderStrategy[]
    let truncated = false
    if (args.providers && args.providers.length > 0) {
      const records = await this.repository.findAll()
      const statusBySlug = new Map(records.map((r) => [r.slug, r.status ?? 'active']))
      targets = args.providers
        .map((slug) => bySlug.get(slug))
        .filter((s): s is IProviderStrategy => s !== undefined)
        .filter((s) => SEARCHABLE_STATUSES.has(statusBySlug.get(s.slug) ?? 'active'))

      if (targets.length === 0) {
        const unknown = args.providers.filter((slug) => !bySlug.has(slug))
        if (unknown.length === args.providers.length) {
          throw new UnknownProviderError(unknown)
        }
      }
    } else {
      const records = await this.repository.findAll()
      const eligible = records
        .filter((r) => SEARCHABLE_STATUSES.has(r.status ?? 'active'))
        .map((r) => r.slug)
      const maxProviders = args.maxProviders ?? DEFAULT_MAX_PROVIDERS
      const wanted = eligible.slice(0, maxProviders)
      truncated = eligible.length > wanted.length
      targets = wanted
        .map((slug) => bySlug.get(slug))
        .filter((s): s is IProviderStrategy => s !== undefined)
    }

    const searchedProviders = targets.map((s) => s.slug)
    const cacheKey = buildCacheKey(query, searchedProviders, limit, args.language)

    if (useCache) {
      const hit = cache.get(cacheKey)
      if (hit && hit.expiresAt > Date.now()) return cloneResult(hit.payload)
      const ongoing = inFlight.get(cacheKey)
      if (ongoing) return cloneResult(await ongoing)
    }

    const run = this.fanOut(query, targets, limit, offset, timeoutMs, truncated, args.language)
    if (!useCache) return run

    const shared = run.then((result) => {
      // Não cacheia resultados com falha de provedores para evitar envenenar o cache por 5 minutos
      if (result.errors.length === 0) {
        pruneCache()
        cache.set(cacheKey, { expiresAt: Date.now() + SEARCH_CACHE_TTL_MS, payload: cloneResult(result) })
      }
      inFlight.delete(cacheKey)
      return result
    })
    inFlight.set(cacheKey, shared)
    return shared
  }

  private async fanOut(
    query: string,
    targets: IProviderStrategy[],
    limit: number,
    offset: number,
    timeoutMs: number,
    truncated: boolean,
    language?: string,
  ): Promise<SearchSourcesResult> {
    const settled = await Promise.allSettled(
      targets.map((strategy) =>
        globalSearchLimiter.schedule(() =>
          withTimeout(
            strategy.search(query, {
              limit,
              offset,
              signal: AbortSignal.timeout(timeoutMs),
              language,
            }),
            timeoutMs,
            strategy.slug,
          ),
        ),
      ),
    )

    const results: ProviderSearchResult[] = []
    const errors: Array<{ providerSlug: string; message: string }> = []
    settled.forEach((outcome, i) => {
      const slug = targets[i]?.slug ?? 'unknown'
      if (outcome.status === 'fulfilled') {
        const seen = new Set<string>()
        for (const r of outcome.value) {
          if (seen.has(r.url)) continue
          seen.add(r.url)

          const providerSlug = r.providerSlug || slug
          let coverUrl = r.coverUrl
          if (coverUrl && HOTLINK_PROTECTED_PROVIDERS.has(providerSlug) && !coverUrl.startsWith('/api/')) {
            coverUrl = buildCoverProxyUrl(coverUrl, providerSlug)
          }

          results.push({
            ...r,
            providerSlug,
            coverUrl,
          })
        }
      } else {
        const reason = outcome.reason
        // SEC-02: erros de rede/parse carregam corpo cru de upstream (URLs
        // internas, tokens, HTML) — trocar por mensagem genérica.
        let message: string
        if (reason instanceof ScrapingNetworkError || reason instanceof ScrapingParseError) {
          message = `Falha no provider ${slug}`
        } else if (reason instanceof Error) {
          message = reason.message
        } else {
          message = String(reason)
        }
        errors.push({ providerSlug: slug, message })
      }
    })

    return { query, results, errors, searchedProviders: targets.map((s) => s.slug), truncated }
  }
}

/**
 * Corrida entre a promise de busca e um timeout: garante que strategies que
 * ignoram o AbortSignal (ex. mocks/tests, HTTP sem suporte) não travem o
 * fan-out além de `timeoutMs`. Rejeita com erro nomeando o provider.
 */
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, slug: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`busca em ${slug} excedeu ${timeoutMs}ms`)),
      timeoutMs,
    )
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
}
