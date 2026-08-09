import type Redis from 'ioredis'
import { createSafeRedis } from '../../redis/safe-redis'
import type { IPubSub, UnsubscribeHandle } from '../pubsub.service'
import { redisConnectionOptions } from './connection-options'

type ChannelCallback = (message: any) => void
type ManyCallback = (channel: string, message: any) => void

/**
 * Adaptador de {@link IPubSub} sobre o Redis (modo web).
 *
 * Espelha a semântica do InMemoryPubSub: um publisher e um subscriber
 * compartilhados, com registro de listeners por canal. As conexões são criadas
 * somente na primeira operação (lazy). A assinatura do canal ocorre no
 * primeiro `subscribe`/`subscribeMany`; o último `unsubscribe` remove o canal.
 */
export class RedisPubSubAdapter implements IPubSub {
  private publisher?: Redis
  private subscriber?: Redis
  private readonly listeners = new Map<string, Set<ChannelCallback>>()
  private readonly connectedChannels = new Set<string>()

  constructor(private readonly options: { redisUrl?: string } = {}) {}

  async publish(channel: string, message: unknown): Promise<void> {
    await this.getPublisher().publish(channel, JSON.stringify(message))
  }

  async subscribe(channel: string, callback: ChannelCallback): Promise<UnsubscribeHandle> {
    await this.addChannel(channel)
    this.callbackSet(channel).add(callback)
    return {
      unsubscribe: async () => {
        await this.unsubscribe(channel, callback)
      },
    }
  }

  async subscribeMany(channels: string[], callback: ManyCallback): Promise<UnsubscribeHandle> {
    const wrappers: Array<{ channel: string; wrapper: ChannelCallback }> = []
    for (const channel of channels) {
      const wrapper: ChannelCallback = (message) => callback(channel, message)
      await this.addChannel(channel)
      this.callbackSet(channel).add(wrapper)
      wrappers.push({ channel, wrapper })
    }
    return {
      unsubscribe: async () => {
        for (const { channel, wrapper } of wrappers) {
          await this.unsubscribe(channel, wrapper)
        }
      },
    }
  }

  async unsubscribe(channel: string, callback: ChannelCallback): Promise<void> {
    const set = this.listeners.get(channel)
    if (!set) return
    set.delete(callback)
    if (set.size === 0) {
      this.listeners.delete(channel)
      await this.removeChannel(channel)
    }
  }

  async unsubscribeMany(channels: string[]): Promise<void> {
    for (const channel of channels) {
      this.listeners.delete(channel)
      await this.removeChannel(channel)
    }
  }

  private getPublisher(): Redis {
    if (!this.publisher) {
      this.publisher = createSafeRedis('infra-pubsub-pub', redisConnectionOptions(this.options.redisUrl))
    }
    return this.publisher
  }

  private getSubscriber(): Redis {
    if (!this.subscriber) {
      this.subscriber = createSafeRedis('infra-pubsub-sub', redisConnectionOptions(this.options.redisUrl))
      this.subscriber.on('message', (channel, data) => {
        const callbacks = this.listeners.get(channel)
        if (!callbacks) return
        const message = this.deserialize(data)
        for (const cb of [...callbacks]) cb(message)
      })
    }
    return this.subscriber
  }

  private callbackSet(channel: string): Set<ChannelCallback> {
    let set = this.listeners.get(channel)
    if (!set) {
      set = new Set()
      this.listeners.set(channel, set)
    }
    return set
  }

  private async addChannel(channel: string): Promise<void> {
    if (!this.connectedChannels.has(channel)) {
      await this.getSubscriber().subscribe(channel)
      this.connectedChannels.add(channel)
    }
  }

  private async removeChannel(channel: string): Promise<void> {
    if (this.connectedChannels.has(channel)) {
      await this.subscriber?.unsubscribe(channel)
      this.connectedChannels.delete(channel)
    }
  }

  private deserialize(data: string): unknown {
    try {
      return JSON.parse(data)
    } catch {
      return data
    }
  }
}
