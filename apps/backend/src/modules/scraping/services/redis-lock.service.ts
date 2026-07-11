import { env } from '../../../shared/config/env'
import Redis from 'ioredis'

const LOCK_TTL_SECONDS = 120
const LOCK_PREFIX = 'lock:source:'

/**
 * Serviço responsável pelo lock distribuído via Redis.
 * Usa uma conexão ioredis própria para evitar conflitos com BullMQ.
 */
export class RedisLockService {
  private readonly redis: Redis
  private readonly workerId: string

  constructor() {
    this.workerId = `worker-${process.pid}-${Date.now()}`
    this.redis = new Redis(env.REDIS_URL)
  }

  private lockKey(sourceId: string): string {
    return `${LOCK_PREFIX}${sourceId}`
  }

  /**
   * Tenta adquirir o lock para um sourceId.
   * Retorna `true` se adquiriu, `false` se outro processo já tem o lock.
   */
  async acquire(sourceId: string): Promise<boolean> {
    // ioredis: set(key, value, expiryMode, time, setMode)
    const result = await this.redis.set(
      this.lockKey(sourceId),
      this.workerId,
      'EX',
      LOCK_TTL_SECONDS,
      'NX',
    )
    return result === 'OK'
  }

  /**
   * Libera o lock somente se pertencer a este worker (atomicidade via Lua).
   */
  async release(sourceId: string): Promise<void> {
    const key = this.lockKey(sourceId)
    const script = `
      if redis.call("GET", KEYS[1]) == ARGV[1] then
        return redis.call("DEL", KEYS[1])
      else
        return 0
      end
    `
    await this.redis.eval(script, 1, key, this.workerId)
  }

  /**
   * Verifica se o lock está ativo para um sourceId.
   */
  async isLocked(sourceId: string): Promise<boolean> {
    const value = await this.redis.get(this.lockKey(sourceId))
    return value !== null
  }
}
