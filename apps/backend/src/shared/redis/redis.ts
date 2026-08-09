import type Redis from 'ioredis'
import { env } from '../config/env'
import { createSafeRedis } from './safe-redis'

let redisInstance: Redis | null = null

/**
 * Retorna a instância singleton do Redis.
 * Reutiliza a mesma conexão entre chamadas.
 *
 * No modo embedded (MI_EMBEDDED_MODE=1) o Redis não está disponível — lança
 * erro claro para falhar cedo em vez de tentar conectar.
 */
export function getRedis(): Redis {
  if (env.MI_EMBEDDED_MODE) {
    throw new Error('Redis não disponível no modo embedded (MI_EMBEDDED_MODE=1)')
  }

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
