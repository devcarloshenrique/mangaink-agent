import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockRedis = {
  rpush: vi.fn().mockResolvedValue(1),
  lrange: vi.fn().mockResolvedValue([]),
  incr: vi.fn().mockResolvedValue(1),
  expire: vi.fn().mockResolvedValue(1),
  publish: vi.fn().mockResolvedValue(1),
  subscribe: vi.fn().mockResolvedValue(undefined),
  unsubscribe: vi.fn().mockResolvedValue(undefined),
  on: vi.fn(),
  quit: vi.fn().mockResolvedValue(undefined),
}

vi.mock('ioredis', () => ({
  default: vi.fn(() => mockRedis),
}))

import { ConversionPubSubService } from '../../services/conversion-pubsub.service'

describe('ConversionPubSubService', () => {
  let pubsub: ConversionPubSubService

  beforeEach(() => {
    vi.clearAllMocks()
    pubsub = new ConversionPubSubService()
  })

  it('pubRpush deve delegar para publisher.rpush', async () => {
    await pubsub.pubRpush('test-key', 'test-value')
    expect(mockRedis.rpush).toHaveBeenCalledWith('test-key', 'test-value')
  })

  it('pubLrange deve delegar para publisher.lrange e retornar array', async () => {
    mockRedis.lrange.mockResolvedValue(['e1', 'e2'])
    const result = await pubsub.pubLrange('test-key', 0, -1)
    expect(mockRedis.lrange).toHaveBeenCalledWith('test-key', 0, -1)
    expect(result).toEqual(['e1', 'e2'])
  })

  it('pubIncr deve delegar para publisher.incr e retornar número', async () => {
    mockRedis.incr.mockResolvedValue(42)
    const result = await pubsub.pubIncr('counter')
    expect(mockRedis.incr).toHaveBeenCalledWith('counter')
    expect(result).toBe(42)
  })

  it('pubExpire deve delegar para publisher.expire', async () => {
    await pubsub.pubExpire('test-key', 3600)
    expect(mockRedis.expire).toHaveBeenCalledWith('test-key', 3600)
  })

  it('publish deve publicar JSON no canal conversion-job:{jobId}', async () => {
    const event = { type: 'test', data: { msg: 'hello' }, timestamp: '2024-01-01' }
    await pubsub.publish('job-001', event)
    expect(mockRedis.publish).toHaveBeenCalledWith('conversion-job:job-001', JSON.stringify(event))
  })
})
