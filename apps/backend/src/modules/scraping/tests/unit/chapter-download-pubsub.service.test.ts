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

import { ChapterDownloadPubSubService } from '../../services/chapter-download-pubsub.service'

describe('ChapterDownloadPubSubService', () => {
  let pubsub: ChapterDownloadPubSubService

  beforeEach(() => {
    vi.clearAllMocks()
    pubsub = new ChapterDownloadPubSubService()
  })

  it('deve publicar no canal chapter-download:{sourceId}:{chapterId}', async () => {
    const event = { type: 'progress', data: { downloaded: 1, total: 10 }, timestamp: '2024-01-01' }
    await pubsub.publish('src-001', 'chap-001', event)
    expect(mockRedis.publish).toHaveBeenCalledWith('chapter-download:src-001:chap-001', JSON.stringify(event))
  })

  it('pubRpush deve delegar para publisher.rpush', async () => {
    await pubsub.pubRpush('test-key', 'val')
    expect(mockRedis.rpush).toHaveBeenCalledWith('test-key', 'val')
  })

  it('pubLrange deve delegar para publisher.lrange', async () => {
    mockRedis.lrange.mockResolvedValue(['a', 'b'])
    const result = await pubsub.pubLrange('test-key', 0, -1)
    expect(result).toEqual(['a', 'b'])
  })

  it('pubIncr deve retornar número incrementado', async () => {
    mockRedis.incr.mockResolvedValue(5)
    const result = await pubsub.pubIncr('counter')
    expect(result).toBe(5)
  })

  it('pubExpire deve definir TTL', async () => {
    await pubsub.pubExpire('key', 600)
    expect(mockRedis.expire).toHaveBeenCalledWith('key', 600)
  })

  it('subscribe deve inscrever no canal Redis', async () => {
    const cb = vi.fn()
    await pubsub.subscribe('src-001', 'chap-001', cb)
    expect(mockRedis.subscribe).toHaveBeenCalledWith('chapter-download:src-001:chap-001')
  })

  it('unsubscribe deve remover inscrição', async () => {
    const cb = vi.fn()
    await pubsub.subscribe('src-001', 'chap-001', cb)
    await pubsub.unsubscribe('src-001', 'chap-001', cb)
    expect(mockRedis.unsubscribe).toHaveBeenCalledWith('chapter-download:src-001:chap-001')
  })
})
