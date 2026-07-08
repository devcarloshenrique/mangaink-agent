import Redis from 'ioredis'
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
    this.publisher = new Redis(env.REDIS_URL)
  }

  private channel(sourceId: string): string {
    return `${CHANNEL_PREFIX}${sourceId}`
  }

  async publish(sourceId: string, message: ProgressMessage): Promise<void> {
    await this.publisher.publish(this.channel(sourceId), JSON.stringify(message))
  }

  subscribe(
    sourceId: string,
    onMessage: (message: ProgressMessage) => void,
  ): { unsubscribe: () => Promise<void> } {
    const subscriber = new Redis(env.REDIS_URL)

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
        await subscriber.unsubscribe()
        await subscriber.quit()
      },
    }
  }
}
