import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MangaDexStrategy } from '../../providers/mangadex/mangadex.provider'
import { createRateLimiter } from '../../rate-limit/rate-limiter'

describe('MangaDexStrategy', () => {
  const limiter = createRateLimiter({ maxConcurrent: 5, minTime: 0 })
  let provider: MangaDexStrategy

  beforeEach(() => {
    provider = new MangaDexStrategy(limiter)
  })

  it('correctly supports MangaDex domains and .mangadex.network CDN', () => {
    expect(provider.supports('https://mangadex.org/title/183b5c1e-5bfd-4f7f-9b21-3ac88c584987')).toBe(true)
    expect(provider.supports('https://api.mangadex.org/manga/183b5c1e-5bfd-4f7f-9b21-3ac88c584987')).toBe(true)
    expect(provider.supports('https://cmdxd98sb0x3yprd.mangadex.network/data/123/1.jpg')).toBe(true)
    expect(provider.supports('https://outro-site.com/manga/123')).toBe(false)
  })

  it('returns correct provider info', () => {
    const info = provider.getInfo()
    expect(info.slug).toBe('mangadex')
    expect(info.name).toBe('MangaDex')
    expect(info.engine).toBe('api')
  })
})
