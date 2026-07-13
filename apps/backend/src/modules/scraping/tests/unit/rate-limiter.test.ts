import { describe, it, expect } from 'vitest'
import { createRateLimiter } from '../../rate-limit/rate-limiter'

describe('createRateLimiter', () => {
  it('deve criar Bottleneck com maxConcurrent e minTime', () => {
    const limiter = createRateLimiter({ maxConcurrent: 5, minTime: 100 })

    expect(limiter).toBeDefined()
    expect(typeof limiter.schedule).toBe('function')
  })

  it('deve aceitar reservoir e reservoirRefreshInterval', () => {
    const limiter = createRateLimiter({
      maxConcurrent: 2,
      minTime: 50,
      reservoir: 10,
      reservoirRefreshInterval: 1000,
    })

    expect(limiter).toBeDefined()
    expect(typeof limiter.schedule).toBe('function')
  })

  it('schedule deve executar a funcao e retornar o resultado', async () => {
    const limiter = createRateLimiter({ maxConcurrent: 10, minTime: 0 })

    const result = await limiter.schedule(() => Promise.resolve(42))
    expect(result).toBe(42)
  })

  it('schedule deve propagar erros da funcao', async () => {
    const limiter = createRateLimiter({ maxConcurrent: 1, minTime: 0 })

    await expect(
      limiter.schedule(() => Promise.reject(new Error('download failed'))),
    ).rejects.toThrow('download failed')
  })

  it('deve enfileirar tasks alem do maxConcurrent', async () => {
    const limiter = createRateLimiter({ maxConcurrent: 1, minTime: 0 })

    const results = await Promise.all([
      limiter.schedule(() => Promise.resolve(1)),
      limiter.schedule(() => Promise.resolve(2)),
      limiter.schedule(() => Promise.resolve(3)),
    ])

    expect(results).toEqual([1, 2, 3])
  })
})
