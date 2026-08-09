import type Redis from 'ioredis'
import { createSafeRedis } from '../../redis/safe-redis'
import type { IJournalStore } from '../journal-store.service'
import { redisConnectionOptions } from './connection-options'

/**
 * Adaptador de {@link IJournalStore} sobre o Redis (modo web).
 * Mapeia a API do contrato para os comandos rpush/lrange/incr/expire.
 * A conexão é criada somente na primeira operação (lazy).
 */
export class RedisJournalAdapter implements IJournalStore {
  private redis?: Redis

  constructor(private readonly options: { redisUrl?: string } = {}) {}

  async append(key: string, entry: unknown): Promise<void> {
    await this.client().rpush(key, JSON.stringify(entry))
  }

  async range(key: string, start: number, end: number): Promise<string[]> {
    return this.client().lrange(key, start, end)
  }

  async nextId(key: string): Promise<number> {
    return this.client().incr(key)
  }

  async expire(key: string, seconds: number): Promise<void> {
    await this.client().expire(key, seconds)
  }

  private client(): Redis {
    if (!this.redis) {
      this.redis = createSafeRedis('infra-journal', redisConnectionOptions(this.options.redisUrl))
    }
    return this.redis
  }
}
