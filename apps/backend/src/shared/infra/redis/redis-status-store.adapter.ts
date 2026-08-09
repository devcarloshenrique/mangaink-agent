import type Redis from 'ioredis'
import { createSafeRedis } from '../../redis/safe-redis'
import type { IStatusStore } from '../status-store.service'
import { redisConnectionOptions } from './connection-options'

/**
 * Adaptador de {@link IStatusStore} sobre o Redis (modo web).
 * Semântica de Hash: `set` faz merge parcial via HSET (ignorando campos
 * `undefined`) com EXPIRE opcional; `get` devolve HGETALL (`null` se vazio);
 * `clear` remove a chave via DEL. A conexão é criada somente na primeira
 * operação (lazy).
 */
export class RedisStatusStoreAdapter implements IStatusStore {
  private redis?: Redis

  constructor(private readonly options: { redisUrl?: string } = {}) {}

  async get(key: string): Promise<Record<string, string> | null> {
    const data = await this.client().hgetall(key)
    if (Object.keys(data).length === 0) return null
    return data
  }

  async set(
    key: string,
    partial: Record<string, string | number | undefined>,
    ttlSeconds?: number,
  ): Promise<void> {
    const flat: string[] = []
    for (const [field, value] of Object.entries(partial)) {
      if (value !== undefined) flat.push(field, String(value))
    }
    if (flat.length === 0) return

    const client = this.client()
    await client.hset(key, ...flat)
    if (ttlSeconds !== undefined) {
      await client.expire(key, ttlSeconds)
    }
  }

  async clear(key: string): Promise<void> {
    await this.client().del(key)
  }

  private client(): Redis {
    if (!this.redis) {
      this.redis = createSafeRedis('infra-status', redisConnectionOptions(this.options.redisUrl))
    }
    return this.redis
  }
}
