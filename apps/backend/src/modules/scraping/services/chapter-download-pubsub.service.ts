import Redis from 'ioredis'
import { env } from '../../../shared/config/env'
import type { Redis as RedisType } from 'ioredis'

export type PubSubCallback = (channel: string, message: string) => void

/**
 * Pub/Sub Redis para eventos de download de capítulo.
 * Canal: `chapter-download:{sourceId}:{chapterId}`.
 * Canal dedicado — não reusa `source:{sourceId}` do scraping.
 */
export class ChapterDownloadPubSubService {
  private readonly publisher: RedisType
  private readonly subscriber: RedisType
  private readonly channelPrefix = 'chapter-download:'
  private readonly listeners = new Map<string, Set<PubSubCallback>>()

  constructor() {
    this.publisher = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null })
    this.subscriber = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null })

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

  private channel(sourceId: string, chapterId: string): string {
    return `${this.channelPrefix}${sourceId}:${chapterId}`
  }

  async publish(
    sourceId: string,
    chapterId: string,
    event: { type: string; data: Record<string, unknown>; timestamp: string },
  ): Promise<void> {
    await this.publisher.publish(this.channel(sourceId, chapterId), JSON.stringify(event))
  }

  async subscribe(sourceId: string, chapterId: string, callback: PubSubCallback): Promise<void> {
    const ch = this.channel(sourceId, chapterId)
    if (!this.listeners.has(ch)) {
      this.listeners.set(ch, new Set())
      await this.subscriber.subscribe(ch)
    }
    this.listeners.get(ch)!.add(callback)
  }

  async unsubscribe(sourceId: string, chapterId: string, callback?: PubSubCallback): Promise<void> {
    const ch = this.channel(sourceId, chapterId)
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
