import { describe, it, expect, beforeEach } from 'vitest'
import { RateLimitRegistry, DEFAULT_RATE_LIMIT } from '../../rate-limit/rate-limit-registry'

describe('RateLimitRegistry', () => {
  let registry: RateLimitRegistry

  beforeEach(() => {
    registry = new RateLimitRegistry()
  })

  describe('defaults', () => {
    it('usa defaults constantes quando nada carregado', () => {
      expect(DEFAULT_RATE_LIMIT).toEqual({ maxConcurrent: 6, minTime: 50 })
    })

    it('get sem load retorna default para qualquer slug', () => {
      const config = registry.get('mangalivre')
      expect(config.maxConcurrent).toBe(6)
      expect(config.minTime).toBe(50)
    })

    it('has retorna false quando nada carregado', () => {
      expect(registry.has('mangalivre')).toBe(false)
    })
  })

  describe('loadFromProviders', () => {
    it('alimenta configs a partir dos providers do banco', () => {
      registry.loadFromProviders([
        { slug: 'mangalivre', maxConcurrent: 8, minTime: 0 },
        { slug: 'imperiodabritannia', maxConcurrent: 2, minTime: 500 },
      ])

      expect(registry.get('mangalivre')).toEqual({ maxConcurrent: 8, minTime: 0 })
      expect(registry.get('imperiodabritannia')).toEqual({ maxConcurrent: 2, minTime: 500 })
      expect(registry.has('mangalivre')).toBe(true)
    })

    it('inclui reservoir e reservoirRefreshInterval quando definidos', () => {
      registry.loadFromProviders([
        {
          slug: 'mangadex',
          maxConcurrent: 5,
          minTime: 100,
          reservoir: 10,
          reservoirRefreshInterval: 1000,
        },
      ])

      const config = registry.get('mangadex')
      expect(config.maxConcurrent).toBe(5)
      expect(config.reservoir).toBe(10)
      expect(config.reservoirRefreshInterval).toBe(1000)
    })

    it('omite reservoir/reservoirRefreshInterval quando undefined', () => {
      registry.loadFromProviders([
        { slug: 'mangadex', maxConcurrent: 5, minTime: 100, reservoir: undefined, reservoirRefreshInterval: undefined },
      ])

      const config = registry.get('mangadex')
      expect(config.maxConcurrent).toBe(5)
      expect(config.reservoir).toBeUndefined()
      expect(config.reservoirRefreshInterval).toBeUndefined()
    })

    it('provider sem config retorna fallback default', () => {
      registry.loadFromProviders([{ slug: 'mangalivre', maxConcurrent: 8, minTime: 0 }])

      const config = registry.get('unknown-provider')
      expect(config.maxConcurrent).toBe(6)
      expect(config.minTime).toBe(50)
    })

    it('loadFromProviders substitui configs anteriores por completo', () => {
      registry.loadFromProviders([{ slug: 'mangalivre', maxConcurrent: 8, minTime: 0 }])
      registry.loadFromProviders([{ slug: 'imperiodabritannia', maxConcurrent: 2, minTime: 500 }])

      expect(registry.has('mangalivre')).toBe(false)
      expect(registry.get('imperiodabritannia')).toEqual({ maxConcurrent: 2, minTime: 500 })
    })
  })

  describe('clear', () => {
    it('limpa todas as configs', () => {
      registry.loadFromProviders([{ slug: 'mangalivre', maxConcurrent: 8, minTime: 0 }])
      registry.clear()

      expect(registry.has('mangalivre')).toBe(false)
      expect(registry.get('mangalivre')).toEqual(DEFAULT_RATE_LIMIT)
    })
  })
})
