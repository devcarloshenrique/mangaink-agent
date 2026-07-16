import { env } from '../config/env'
import { getRedis } from './redis'
import type { JobStatus } from '../../modules/conversion/types/conversion.types'

export interface LiveJobStatus {
  status: JobStatus
  currentStep: string
  progress: number
  downloadedImages: number
  totalImages: number
  updatedAt: string
  completedAt?: string
  downloadUrl?: string
  outputFile?: string
  outputSize?: number
  error?: string
}

function key(jobId: string): string {
  return `conv:status:${jobId}`
}

export class JobLiveStatusStore {
  async set(jobId: string, partial: Partial<LiveJobStatus>): Promise<void> {
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

  async get(jobId: string): Promise<LiveJobStatus | null> {
    const redis = getRedis()
    const data = await redis.hgetall(key(jobId))
    if (!Object.keys(data).length) return null

    return {
      status: data.status as JobStatus,
      currentStep: data.currentStep ?? '',
      progress: Number(data.progress ?? 0),
      downloadedImages: Number(data.downloadedImages ?? 0),
      totalImages: Number(data.totalImages ?? 0),
      updatedAt: data.updatedAt ?? '',
      completedAt: data.completedAt || undefined,
      downloadUrl: data.downloadUrl || undefined,
      outputFile: data.outputFile || undefined,
      outputSize: data.outputSize ? Number(data.outputSize) : undefined,
      error: data.error || undefined,
    }
  }

  async clear(jobId: string): Promise<void> {
    const redis = getRedis()
    await redis.del(key(jobId))
  }

  async setTerminal(
    jobId: string,
    fields: Partial<LiveJobStatus>,
  ): Promise<void> {
    await this.set(jobId, fields)
  }
}
