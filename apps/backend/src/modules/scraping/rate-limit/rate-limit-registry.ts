import { env } from '../../../shared/config/env'
import type { RateLimiterConfig } from './types'

const SLUG_PARAMS = ['MAX_CONCURRENT', 'MIN_TIME', 'RESERVOIR', 'RESERVOIR_REFRESH_INTERVAL'] as const

export class RateLimitRegistry {
  private readonly configs = new Map<string, RateLimiterConfig>()
  private readonly defaults: RateLimiterConfig

  constructor() {
    this.defaults = {
      maxConcurrent: env.RATE_LIMIT_DEFAULT_MAX_CONCURRENT,
      minTime: env.RATE_LIMIT_DEFAULT_MIN_TIME,
    }

    this.parseEnvVars()
  }

  get(slug: string): RateLimiterConfig {
    return this.configs.get(slug) ?? this.defaults
  }

  has(slug: string): boolean {
    return this.configs.has(slug)
  }

  private parseEnvVars(): void {
    const envRecord = env as Record<string, unknown>

    for (const [key, value] of Object.entries(envRecord)) {
      if (!key.startsWith('RATE_LIMIT_')) continue
      if (key.startsWith('RATE_LIMIT_DEFAULT_')) continue
      if (value === undefined || value === null) continue

      const rest = key.slice('RATE_LIMIT_'.length)
      let slug = ''
      let param = ''

      for (const p of SLUG_PARAMS) {
        if (rest.endsWith(`_${p}`)) {
          param = p
          slug = rest.slice(0, rest.length - p.length - 1)
          break
        }
      }

      if (!slug || !param) continue

      slug = slug.toLowerCase().replace(/_/g, '')

      const existing = this.configs.get(slug) ?? { maxConcurrent: 0, minTime: 0 }
      const numValue = Number(value)

      switch (param) {
        case 'MAX_CONCURRENT':
          existing.maxConcurrent = numValue
          break
        case 'MIN_TIME':
          existing.minTime = numValue
          break
        case 'RESERVOIR':
          existing.reservoir = numValue
          break
        case 'RESERVOIR_REFRESH_INTERVAL':
          existing.reservoirRefreshInterval = numValue
          break
      }

      this.configs.set(slug, existing)
    }
  }
}
