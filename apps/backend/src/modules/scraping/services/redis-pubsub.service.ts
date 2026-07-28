import Redis from 'ioredis'
import { createSafeRedis } from '../../../shared/redis/safe-redis'
import { env } from '../../../shared/config/env'

export type ProgressStage = 'metadata' | 'chapters' | 'covers' | 'completed' | 'failed'

export interface ProgressMessage {
  stage: ProgressStage
  progress?: number
  message?: string
}

const CHANNEL_PREFIX = 'source:'

/**
 * Serviço de Pub/Sub Redis para comunicação entre Workers e SSE.
 * Cada instância cria sua própria conexão Redis.
 */
export class RedisPubSubService {
  private readonly publisher: Redis

  constructor() {
    this.publisher = createSafeRedis('source-pubsub-pub')
  }

  private channel(sourceId: string): string {
    return `${CHANNEL_PREFIX}${sourceId}`
  }

  async publish(sourceId: string, message: ProgressMessage): Promise<void> {
    try {
      await this.publisher.publish(this.channel(sourceId), JSON.stringify(message))
    } catch (err) {
      console.warn(
        `[RedisPubSub] Falha ao publicar para ${sourceId}:`,
        err instanceof Error ? err.message : 'unknown',
      )
    }
  }

  subscribe(
    sourceId: string,
    onMessage: (message: ProgressMessage) => void,
  ): { unsubscribe: () => Promise<void> } {
    const subscriber = createSafeRedis('source-pubsub-sub')

    subscriber.subscribe(this.channel(sourceId))

    subscriber.on('message', (_channel, data) => {
      try {
        const parsed = JSON.parse(data) as ProgressMessage
        onMessage(parsed)
      } catch {
        // Ignora mensagens inválidas
      }
    })

    return {
      unsubscribe: async () => {
        try {
          await subscriber.unsubscribe()
          await subscriber.quit()
        } catch {
          // Conexão pode já estar fechada durante shutdown
        }
      },
    }
  }
}

