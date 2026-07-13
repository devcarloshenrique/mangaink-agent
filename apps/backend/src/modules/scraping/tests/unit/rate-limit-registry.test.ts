import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../../shared/config/env', () => ({
  env: {
    RATE_LIMIT_DEFAULT_MAX_CONCURRENT: 6,
    RATE_LIMIT_DEFAULT_MIN_TIME: 50,
    RATE_LIMIT_MANGALIVRE_MAX_CONCURRENT: 8,
    RATE_LIMIT_MANGALIVRE_MIN_TIME: 0,
    RATE_LIMIT_MANGADEX_MAX_CONCURRENT: 5,
    RATE_LIMIT_MANGADEX_RESERVOIR: 10,
    RATE_LIMIT_MANGADEX_RESERVOIR_REFRESH_INTERVAL: 1000,
  },
}))

import { RateLimitRegistry } from '../../rate-limit/rate-limit-registry'

describe('RateLimitRegistry', () => {
  let registry: RateLimitRegistry

  beforeEach(() => {
    registry = new RateLimitRegistry()
  })

  describe('get', () => {
    it('deve retornar config especifica para provider com env vars', () => {
      const config = registry.get('mangalivre')
      expect(config.maxConcurrent).toBe(8)
      expect(config.minTime).toBe(0)
    })

    it('deve retornar fallback default para provider sem config especifica', () => {
      const config = registry.get('unknown-provider')
      expect(config.maxConcurrent).toBe(6)
      expect(config.minTime).toBe(50)
    })

    it('deve incluir reservoir e reservoirRefreshInterval quando definidos', () => {
      const config = registry.get('mangadex')
      expect(config.maxConcurrent).toBe(5)
      expect(config.reservoir).toBe(10)
      expect(config.reservoirRefreshInterval).toBe(1000)
    })
  })

  describe('has', () => {
    it('deve retornar true para provider com config explicita', () => {
      expect(registry.has('mangalivre')).toBe(true)
    })

    it('deve retornar false para provider sem config', () => {
      expect(registry.has('unknown-provider')).toBe(false)
    })
  })
})
