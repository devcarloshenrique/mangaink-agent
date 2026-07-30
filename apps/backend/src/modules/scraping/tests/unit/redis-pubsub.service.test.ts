import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { RedisPubSubService } from '../../services/redis-pubsub.service'

vi.mock('ioredis', () => {
  const mockRedis = {
    publish: vi.fn().mockResolvedValue(1),
    subscribe: vi.fn(),
    on: vi.fn(),
    unsubscribe: vi.fn().mockResolvedValue(undefined),
    quit: vi.fn().mockResolvedValue(undefined),
  }
  return {
    default: vi.fn(() => mockRedis),
  }
})

describe('RedisPubSubService', () => {
  let pubsub: RedisPubSubService
  let mockRedis: Record<string, ReturnType<typeof vi.fn>>

  beforeEach(async () => {
    vi.clearAllMocks()
    pubsub = new RedisPubSubService()
    const { default: Redis } = await import('ioredis')
    mockRedis = (Redis as ReturnType<typeof vi.fn>).mock.results[0].value
  })

  describe('publish', () => {
    it('deve publicar mensagem no canal da source', async () => {
      await pubsub.publish('src-test-12345678', {
        stage: 'completed',
        progress: 100,
      })

      expect(mockRedis.publish).toHaveBeenCalledWith(
        'source:src-test-12345678',
        JSON.stringify({ stage: 'completed', progress: 100 }),
      )
    })

    it('deve publicar mensagem com message opcional', async () => {
      await pubsub.publish('src-test-12345678', {
        stage: 'metadata',
        progress: 10,
        message: 'Obtendo informações',
      })

      expect(mockRedis.publish).toHaveBeenCalledWith(
        'source:src-test-12345678',
        JSON.stringify({ stage: 'metadata', progress: 10, message: 'Obtendo informações' }),
      )
    })
  })

  describe('subscribe', () => {
    it('deve retornar objeto com unsubscribe', () => {
      const subscription = pubsub.subscribe('src-test-12345678', vi.fn())
      expect(subscription).toHaveProperty('unsubscribe')
      expect(typeof subscription.unsubscribe).toBe('function')
    })

    it('deve registrar listener no Redis', () => {
      pubsub.subscribe('src-test-12345678', vi.fn())
      expect(mockRedis.subscribe).toHaveBeenCalledWith('source:src-test-12345678')
      expect(mockRedis.on).toHaveBeenCalledWith('message', expect.any(Function))
    })

    it('deve chamar callback quando mensagem chega', () => {
      const callback = vi.fn()
      pubsub.subscribe('src-test-12345678', callback)

      // Simular recebimento de mensagem
      const messageHandler = mockRedis.on.mock.calls.find(
        (call: string[]) => call[0] === 'message',
      )?.[1]
      messageHandler('source:src-test-12345678', JSON.stringify({ stage: 'completed', progress: 100 }))

      expect(callback).toHaveBeenCalledWith({ stage: 'completed', progress: 100 })
    })

    it('deve ignorar mensagens JSON inválidas', () => {
      const callback = vi.fn()
      pubsub.subscribe('src-test-12345678', callback)

      const messageHandler = mockRedis.on.mock.calls.find(
        (call: string[]) => call[0] === 'message',
      )?.[1]
      messageHandler('source:src-test-12345678', 'invalid json')

      expect(callback).not.toHaveBeenCalled()
    })
  })
})