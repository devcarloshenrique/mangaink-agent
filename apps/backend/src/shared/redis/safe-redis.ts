import Redis from 'ioredis'
import type { RedisOptions } from 'ioredis'
import { env } from '../config/env'

/**
 * Registro global de todas as conexões Redis criadas via `createSafeRedis`.
 * Usado pelo graceful shutdown para fechar todas as conexões de forma ordenada.
 */
const connections: Redis[] = []

/**
 * Cria uma conexão Redis com tratamento de erro padrão.
 *
 * Toda conexão criada por esta factory:
 * 1. Possui um listener `error` para evitar crash por uncaught exception.
 * 2. É registrada globalmente para ser fechada no graceful shutdown.
 *
 * @param label — rótulo para logs (ex: 'pubsub-publisher', 'lock')
 * @param opts  — opções extras do ioredis (mescladas sobre as defaults)
 */
export function createSafeRedis(label: string, opts?: Partial<RedisOptions>): Redis {
  if (env.MI_EMBEDDED_MODE) {
    throw new Error('Redis não disponível no modo embedded (MI_EMBEDDED_MODE=1)')
  }

  const instance = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    ...opts,
  })

  instance.on('error', (err) => {
    console.error(`[Redis:${label}] Erro de conexão:`, err.message)
  })

  connections.push(instance)
  return instance
}

/**
 * Fecha todas as conexões Redis registradas de forma ordenada.
 * Chamado durante o graceful shutdown (SIGTERM/SIGINT).
 */
export async function closeAllRedisConnections(): Promise<void> {
  const pending = connections.map(async (conn) => {
    try {
      if (conn.status === 'ready' || conn.status === 'connecting') {
        await conn.quit()
      }
    } catch {
      // Ignora erros ao fechar — a conexão pode já estar fechada.
    }
  })

  await Promise.allSettled(pending)
  connections.length = 0
}
