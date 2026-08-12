import { KNOWN_PROVIDERS } from './known-providers'
import { getProviderRepository } from '../../../shared/database/repositories'
import { getProviderResolver } from '../utils/resolve-provider'
import {
  DEFAULT_RATE_LIMIT,
  type ProviderRateLimitConfig,
} from '../rate-limit/rate-limit-registry'

/**
 * Inicializa os providers no boot (MEC-31 S5):
 * 1. seed/upsert dos providers no banco a partir do `known-providers.ts`;
 * 2. carrega as configs de rate limit persistidas no `RateLimitRegistry`;
 * 3. reconstrói o singleton `ProviderResolver` (registry + limiters + strategies).
 *
 * Deve ser chamado dentro de try/catch no boot (ver `server.ts`): uma falha de
 * banco/migration não pode derrubar o servidor — o fallback são os valores
 * estáticos de `known-providers.ts`.
 */
export async function initProviders(): Promise<void> {
  const repository = getProviderRepository()
  const resolver = getProviderResolver()

  // 1. Upsert dos providers ausentes/desatualizados no banco.
  await repository.upsertFromSeed(KNOWN_PROVIDERS)

  // 2. Configs de rate limit persistidas no banco (fonte de verdade após o seed).
  const providers = await repository.findAll()
  const configs: ProviderRateLimitConfig[] = providers.map((provider) => ({
    slug: provider.slug,
    maxConcurrent: provider.rateLimitMaxConcurrent,
    minTime: provider.rateLimitMinTime,
    reservoir: provider.rateLimitReservoir ?? undefined,
    reservoirRefreshInterval: provider.rateLimitReservoirRefreshInterval ?? undefined,
  }))

  // 3. Atualiza o singleton: `loadFromProviders` alimenta o registry e chama
  //    `refresh()`, reconstruindo as strategies com os limiters compartilhados.
  resolver.loadFromProviders(configs)
}

/** Configs de rate limit derivadas do seed (`known-providers.ts`). */
function seedRateLimitConfigs(): ProviderRateLimitConfig[] {
  return KNOWN_PROVIDERS.map((p) => ({
    slug: p.slug,
    maxConcurrent: p.rateLimitMaxConcurrent ?? DEFAULT_RATE_LIMIT.maxConcurrent,
    minTime: p.rateLimitMinTime ?? DEFAULT_RATE_LIMIT.minTime,
    reservoir: p.rateLimitReservoir ?? undefined,
    reservoirRefreshInterval: p.rateLimitReservoirRefreshInterval ?? undefined,
  }))
}

/**
 * Fallback real do boot quando `initProviders()` falha (banco/migration
 * indisponível): carrega os rate limits do seed no `RateLimitRegistry` para
 * que `get(slug)` NÃO retorne o DEFAULT (6/50) para todos os providers.
 * Usado no catch do `server.ts` — a mensagem de log reflete exatamente isso.
 */
export function loadProviderRateLimitsFromSeed(): void {
  getProviderResolver().loadFromProviders(seedRateLimitConfigs())
}
