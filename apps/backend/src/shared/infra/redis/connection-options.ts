import type { RedisOptions } from 'ioredis'

/**
 * Converte uma URL Redis (`redis://user:pass@host:6379/2`) em opções do
 * ioredis, para repassar ao `createSafeRedis` quando o chamador fornece
 * uma URL explícita. Sem URL, devolve `undefined` (a conexão usa
 * `env.REDIS_URL`).
 */
export function redisConnectionOptions(redisUrl?: string): Partial<RedisOptions> | undefined {
  if (!redisUrl) return undefined

  const parsed = new URL(redisUrl)
  const opts: Partial<RedisOptions> = {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 6379,
  }
  if (parsed.username) opts.username = decodeURIComponent(parsed.username)
  if (parsed.password) opts.password = decodeURIComponent(parsed.password)

  const db = parsed.pathname.replace(/^\//, '')
  if (db !== '') opts.db = Number(db) || 0

  return opts
}
