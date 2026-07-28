import { createSafeRedis } from '../../../shared/redis/safe-redis'
import type { Redis as RedisType } from 'ioredis'

export type PubSubCallback = (channel: string, message: string) => void

/**
 * Pub/Sub Redis para eventos de Conversion e Job.
 *
 * Canal por Job: `conversion-job:{jobId}`.
 * O fan-in de Conversion é feito assinando todos os canais de job da Conversion.
 */
export class ConversionPubSubService {
  private readonly publisher: RedisType
  private readonly subscriber: RedisType
  private readonly channelPrefix = 'conversion-job:'
  private readonly listeners = new Map<string, Set<PubSubCallback>>()

  constructor() {
    // Conexões separadas: publisher e subscriber NÃO podem compartilhar
    // a mesma conexão Redis — subscribe() coloca a conexão em "subscriber mode"
    // e qualquer comando não-subscriber (como PUBLISH) falha.
    this.publisher = createSafeRedis('conv-pubsub-pub')
    this.subscriber = createSafeRedis('conv-pubsub-sub')

    this.subscriber.on('message', (channel, message) => {
      const callbacks = this.listeners.get(channel)
      if (callbacks) {
        for (const cb of callbacks) {
          try {
            cb(channel, message)
          } catch {
            // callback isolado
          }
        }
      }
    })
  }

  private channel(jobId: string): string {
    return `${this.channelPrefix}${jobId}`
  }

  async publish(
    jobId: string,
    event: { type: string; data: Record<string, unknown>; timestamp: string },
  ): Promise<void> {
    await this.publisher.publish(this.channel(jobId), JSON.stringify(event))
  }

  async subscribe(jobId: string, callback: PubSubCallback): Promise<void> {
    const ch = this.channel(jobId)
    if (!this.listeners.has(ch)) {
      this.listeners.set(ch, new Set())
      await this.subscriber.subscribe(ch)
    }
    this.listeners.get(ch)!.add(callback)
  }

  async unsubscribe(jobId: string, callback?: PubSubCallback): Promise<void> {
    const ch = this.channel(jobId)
    const set = this.listeners.get(ch)
    if (!set) return
    if (callback) {
      set.delete(callback)
    } else {
      set.clear()
    }
    if (set.size === 0) {
      this.listeners.delete(ch)
      await this.subscriber.unsubscribe(ch)
    }
  }

  /** Assina múltiplos canais de job com a mesma callback (fan-in de Conversion). */
  async subscribeMany(jobIds: string[], callback: PubSubCallback): Promise<void> {
    for (const jobId of jobIds) {
      await this.subscribe(jobId, callback)
    }
  }

  /** Desassina múltiplos canais (cleanup do fan-in). */
  async unsubscribeMany(jobIds: string[], callback: PubSubCallback): Promise<void> {
    for (const jobId of jobIds) {
      await this.unsubscribe(jobId, callback)
    }
  }

  async pubRpush(key: string, value: string): Promise<void> {
    await this.publisher.rpush(key, value)
  }

  async pubLrange(key: string, start: number, end: number): Promise<string[]> {
    return this.publisher.lrange(key, start, end)
  }

  async pubIncr(key: string): Promise<number> {
    return this.publisher.incr(key)
  }

  async pubExpire(key: string, seconds: number): Promise<void> {
    await this.publisher.expire(key, seconds)
  }

  async close(): Promise<void> {
    this.listeners.clear()
    await this.publisher.quit()
    await this.subscriber.quit()
  }
}