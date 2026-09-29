import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MangapillStrategy } from './mangapill.provider'
import type { RateLimiter } from '../../rate-limit/types'

describe('MangapillStrategy', () => {
  let strategy: MangapillStrategy
  let mockRateLimiter: RateLimiter

  beforeEach(() => {
    mockRateLimiter = {
      schedule: vi.fn((fn: any) => fn()),
    } as unknown as RateLimiter

    strategy = new MangapillStrategy(mockRateLimiter)
  })

  describe('supports', () => {
    it('deve aceitar URLs do Mangapill', () => {
      expect(
        strategy.supports('https://mangapill.com/manga/5121/ori-no-naka-no-soloist'),
      ).toBe(true)
    })

    it('deve rejeitar outros domínios', () => {
      expect(strategy.supports('https://taiyo.moe/media/123')).toBe(false)
      expect(strategy.supports('invalid-url')).toBe(false)
    })
  })

  describe('getInfo', () => {
    it('deve retornar metadados corretos', () => {
      const info = strategy.getInfo()
      expect(info.slug).toBe('mangapill')
      expect(info.name).toBe('Mangapill')
      expect(info.engine).toBe('cheerio')
    })
  })
})
