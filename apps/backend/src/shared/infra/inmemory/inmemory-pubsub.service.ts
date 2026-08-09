import type { IPubSub, UnsubscribeHandle } from '../pubsub.service'

type ChannelCallback = (message: any) => void
type ManyCallback = (channel: string, message: any) => void

/**
 * Pub/Sub in-memory por canal — implementação embedded (desktop) do IPubSub.
 * Substitui o Redis quando não há infraestrutura externa disponível.
 *
 * Fan-out: os callbacks são invocados síncronamente, em ordem de registro, sem
 * aguardar o retorno (não bloqueante). Erros individuais são isolados via
 * try/catch (console.error) — um callback que lança não derruba os demais.
 */
export class InMemoryPubSub implements IPubSub {
  private readonly listeners = new Map<string, Set<ChannelCallback>>()

  private callbackSet(channel: string): Set<ChannelCallback> {
    let set = this.listeners.get(channel)
    if (!set) {
      set = new Set()
      this.listeners.set(channel, set)
    }
    return set
  }

  async publish(channel: string, message: unknown): Promise<void> {
    const callbacks = this.listeners.get(channel)
    if (!callbacks) return
    for (const cb of callbacks) {
      try {
        cb(message)
      } catch (error) {
        console.error(`[InMemoryPubSub] erro em callback do canal "${channel}"`, error)
      }
    }
  }

  async subscribe(channel: string, callback: ChannelCallback): Promise<UnsubscribeHandle> {
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
    }
  }

  async unsubscribeMany(channels: string[]): Promise<void> {
    for (const channel of channels) {
      this.listeners.delete(channel)
    }
  }
}
