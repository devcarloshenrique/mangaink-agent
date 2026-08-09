import { env } from '../config/env'
import type { IStatusStore } from '../infra'
import { InMemoryStatusStore } from '../infra/inmemory'
import { RedisStatusStoreAdapter } from '../infra/redis'
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

/**
 * Status live de Conversion Jobs — delega a persistência para um {@link IStatusStore}.
 * Default: `InMemoryStatusStore` no modo embedded (`env.MI_EMBEDDED_MODE`),
 * `RedisStatusStoreAdapter` (lazy) no modo web. Injeção explícita sobrepõe.
 */
export class JobLiveStatusStore {
  constructor(
    private readonly store: IStatusStore = env.MI_EMBEDDED_MODE
      ? new InMemoryStatusStore()
      : new RedisStatusStoreAdapter(),
  ) {}

  async set(jobId: string, partial: Partial<LiveJobStatus>): Promise<void> {
    const flat: Record<string, string | number | undefined> = {}
    for (const [field, value] of Object.entries(partial)) {
      if (value !== undefined) flat[field] = value
    }
    if (Object.keys(flat).length === 0) return
    await this.store.set(key(jobId), flat, env.JOB_STATUS_TTL_SEC)
  }

  async get(jobId: string): Promise<LiveJobStatus | null> {
    const data = await this.store.get(key(jobId))
    if (!data) return null

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
    await this.store.clear(key(jobId))
  }

  async setTerminal(
    jobId: string,
    fields: Partial<LiveJobStatus>,
  ): Promise<void> {
    await this.set(jobId, fields)
  }
}
