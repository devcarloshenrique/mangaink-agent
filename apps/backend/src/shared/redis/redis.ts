import type Redis from 'ioredis'
import { createSafeRedis } from './safe-redis'

let redisInstance: Redis | null = null

/**
 * Retorna a instância singleton do Redis.
 * Reutiliza a mesma conexão entre chamadas.
 */
export function getRedis(): Redis {
  if (!redisInstance) {
    redisInstance = createSafeRedis('singleton', {
      lazyConnect: true,
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
