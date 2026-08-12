import type { RateLimiterConfig } from './types'

/** Defaults aplicados a qualquer provider sem config específica no banco. */
export const DEFAULT_RATE_LIMIT: RateLimiterConfig = {
  maxConcurrent: 6,
  minTime: 50,
}

export interface ProviderRateLimitConfig {
  slug: string
  maxConcurrent: number
  minTime: number
  reservoir?: number
  reservoirRefreshInterval?: number
}

/** Normaliza uma config de provider para o shape interno do limiter. */
function normalizeRateLimitConfig(config: ProviderRateLimitConfig): RateLimiterConfig {
  return {
    maxConcurrent: config.maxConcurrent,
    minTime: config.minTime,
    ...(config.reservoir !== undefined && config.reservoir !== null
      ? { reservoir: config.reservoir }
      : {}),
    ...(config.reservoirRefreshInterval !== undefined && config.reservoirRefreshInterval !== null
      ? { reservoirRefreshInterval: config.reservoirRefreshInterval }
      : {}),
  }
}

/**
 * Registry de rate limits alimentado pelo banco (model `Provider`), sem
 * dependência de env vars de rate limit (decisão MEC-31 S4).
 */
export class RateLimitRegistry {
  private readonly configs = new Map<string, RateLimiterConfig>()

  get(slug: string): RateLimiterConfig {
    return this.configs.get(slug) ?? { ...DEFAULT_RATE_LIMIT }
  }

  has(slug: string): boolean {
    return this.configs.has(slug)
  }

  /**
   * Alimenta o registry a partir dos providers persistidos no banco.
   * Substitui a configuração anterior por completo (mapa recriado).
   */
  loadFromProviders(configs: ProviderRateLimitConfig[]): void {
    this.configs.clear()
    for (const config of configs) {
      this.configs.set(config.slug, normalizeRateLimitConfig(config))
    }
  }

  /**
   * Insere/atualiza a config de rate limit de um único provider
   * (usado no PATCH de providers, após persistir no banco).
   */
  set(config: ProviderRateLimitConfig): void {
    this.configs.set(config.slug, normalizeRateLimitConfig(config))
  }

  /** Limpa todas as configs (uso em testes). */
  clear(): void {
    this.configs.clear()
  }

  /** Todas as configs carregadas (slug → config). */
  entries(): Map<string, RateLimiterConfig> {
    return new Map(this.configs)
  }
}
