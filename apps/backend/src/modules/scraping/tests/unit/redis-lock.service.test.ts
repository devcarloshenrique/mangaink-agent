import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { RedisLockService } from '../../services/redis-lock.service'

vi.mock('ioredis', () => {
  const mockRedis = {
    set: vi.fn(),
    get: vi.fn(),
    eval: vi.fn(),
    quit: vi.fn(),
    on: vi.fn(),
  }
  return {
    default: vi.fn(() => mockRedis),
  }
})

describe('RedisLockService', () => {
  let lockService: RedisLockService
  let mockRedis: Record<string, ReturnType<typeof vi.fn>>

  beforeEach(async () => {
    const { default: Redis } = await import('ioredis')
    lockService = new RedisLockService()
    mockRedis = (Redis as ReturnType<typeof vi.fn>).mock.results[0].value
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('acquire', () => {
    it('deve retornar true quando lock é adquirido', async () => {
      mockRedis.set.mockResolvedValue('OK')
      const result = await lockService.acquire('src-test-12345678')
      expect(result).toBe(true)
    })

    it('deve retornar false quando lock já está ocupado', async () => {
      mockRedis.set.mockResolvedValue(null)
      const result = await lockService.acquire('src-test-12345678')
      expect(result).toBe(false)
    })

    it('deve usar SET NX EX com TTL de 120s', async () => {
      mockRedis.set.mockResolvedValue('OK')
      await lockService.acquire('src-test-12345678')
      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        'EX',
        120,
        'NX',
      )
    })
  })

  describe('release', () => {
    it('deve executar script Lua para liberação atômica', async () => {
      mockRedis.eval.mockResolvedValue(1)
      await lockService.release('src-test-12345678')
      expect(mockRedis.eval).toHaveBeenCalledWith(
        expect.stringContaining('redis.call("GET", KEYS[1])'),
        1,
        expect.stringContaining('lock:source:src-test-12345678'),
        expect.any(String),
      )
    })
  })

  describe('isLocked', () => {
    it('deve retornar true quando lock existe', async () => {
      mockRedis.get.mockResolvedValue('worker-123-456')
      const result = await lockService.isLocked('src-test-12345678')
      expect(result).toBe(true)
    })

    it('deve retornar false quando lock não existe', async () => {
      mockRedis.get.mockResolvedValue(null)
      const result = await lockService.isLocked('src-test-12345678')
      expect(result).toBe(false)
    })
  })
})