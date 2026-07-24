import Redis from 'ioredis'
import { env } from '../../../shared/config/env'
import type { Redis as RedisType } from 'ioredis'

const PREFIX = 'chapter-download-active:'
const TTL = 86400 // 24h

let _redis: RedisType | null = null

function getRedis(): RedisType {
  if (!_redis) {
    _redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null })
  }
  return _redis
}

function key(sourceId: string, chapterId: string): string {
  return `${PREFIX}${sourceId}:${chapterId}`
}

/**
 * Armazena o status de um job de download no Redis Hash.
 * Usado pelo worker (start/completed/failed) e pelo POST /download (idempotência).
 */
export async function setJobStatus(
  sourceId: string,
  chapterId: string,
  jobId: string,
  status: string,
): Promise<void> {
  const redis = getRedis()
  await redis.hmset(key(sourceId, chapterId), { jobId, status })
  await redis.expire(key(sourceId, chapterId), TTL)
}

/**
 * Recupera o status de um job de download do Redis Hash.
 * Retorna null se não existir registro ativo.
 */
export async function getJobStatus(
  sourceId: string,
  chapterId: string,
): Promise<{ jobId: string; status: string } | null> {
  const redis = getRedis()
  const data = await redis.hgetall(key(sourceId, chapterId))
  if (!data || Object.keys(data).length === 0) return null
  return { jobId: data.jobId, status: data.status }
}
