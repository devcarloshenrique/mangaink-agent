import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MangaReadStrategy } from './mangaread.provider'
import type { RateLimiter } from '../../rate-limit/types'

describe('MangaReadStrategy', () => {
  let strategy: MangaReadStrategy
  let mockRateLimiter: RateLimiter

  beforeEach(() => {
    mockRateLimiter = {
      schedule: vi.fn((fn: any) => fn()),
    } as unknown as RateLimiter

    strategy = new MangaReadStrategy(mockRateLimiter)
  })

  describe('supports', () => {
    it('deve aceitar URLs do MangaRead', () => {
      expect(
        strategy.supports('https://www.mangaread.org/manga/solo-leveling/'),
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
      expect(info.slug).toBe('mangaread')
      expect(info.name).toBe('MangaRead')
      expect(info.engine).toBe('cheerio')
    })
  })
})
