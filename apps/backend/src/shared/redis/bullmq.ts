import { Queue } from 'bullmq'
import { env } from '../config/env'

/**
 * Cria uma fila BullMQ com configurações padrão.
 * Usa conexão por URL para evitar conflitos de versão do ioredis.
 */
export function createQueue<T>(name: string): Queue<T> {
  return new Queue<T>(name, {
    connection: {
      url: env.REDIS_URL,
    },
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
    },
  })
}
