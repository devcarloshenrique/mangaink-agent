import Redis from 'ioredis'
import { env } from '../config/env'

let redisInstance: Redis | null = null

/**
 * Retorna a instância singleton do Redis.
 * Reutiliza a mesma conexão entre chamadas.
 */
export function getRedis(): Redis {
  if (!redisInstance) {
    redisInstance = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null, // Necessário para BullMQ
      lazyConnect: true,
    })

    redisInstance.on('error', (err) => {
      console.error('[Redis] Erro de conexão:', err.message)
    })

    redisInstance.on('connect', () => {
      console.log('[Redis] Conectado com sucesso')
    })
  }

  return redisInstance
}

/**
 * Fecha a conexão Redis (útil em testes e graceful shutdown).
 */
export async function closeRedis(): Promise<void> {
  if (redisInstance) {
    await redisInstance.quit()
    redisInstance = null
  }
}
