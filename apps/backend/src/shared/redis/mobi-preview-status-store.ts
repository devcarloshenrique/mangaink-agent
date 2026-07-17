import { env } from '../config/env'
import { getRedis } from './redis'
import type { MobiPreviewLiveState, MobiPreviewLiveStatus } from '../../modules/conversion/types/mobi-preview.types'

function key(jobId: string): string {
  return `mobi:preview:status:${jobId}`
}

/**
 * Armazena estado live da extracao de preview MOBI em Redis Hash.
 *
 * Reusa `JOB_STATUS_TTL_SEC` (mesma janela das Conversion Jobs) — preview e
 * efemero: se ninguem escuta por 6h, regsdescarta. O cache em /temp tem TTL
 * proprio (`MOBI_PREVIEW_TTL_SEC`, default 24h), gerenciado pelo
 * `MobiPreviewService`.
 */
export class MobiPreviewStatusStore {
  async set(jobId: string, partial: Partial<MobiPreviewLiveState>): Promise<void> {
    const redis = getRedis()
    const k = key(jobId)
    const flat: string[] = []
    for (const [field, value] of Object.entries(partial)) {
      if (value !== undefined) {
        flat.push(field, String(value))
      }
    }
    if (flat.length === 0) return
    await redis.hset(k, ...flat)
    await redis.expire(k, env.JOB_STATUS_TTL_SEC)
  }

  async get(jobId: string): Promise<MobiPreviewLiveState | null> {
    const redis = getRedis()
    const data = await redis.hgetall(key(jobId))
    if (!Object.keys(data).length) return null

    return {
      status: (data.status as MobiPreviewLiveStatus) ?? 'queued',
      currentStep: data.currentStep ?? '',
      totalPages: Number(data.totalPages ?? 0),
      readyPages: Number(data.readyPages ?? 0),
      updatedAt: data.updatedAt ?? '',
      completedAt: data.completedAt || undefined,
      error: data.error || undefined,
    }
  }

  async clear(jobId: string): Promise<void> {
    const redis = getRedis()
    await redis.del(key(jobId))
  }
}