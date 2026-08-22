import { env } from '../config/env'
import type { IStatusStore } from '../infra'
import { InMemoryStatusStore } from '../infra/inmemory'
import { RedisStatusStoreAdapter } from '../infra/redis'
import type { MobiPreviewLiveState, MobiPreviewLiveStatus } from '../../modules/conversion/types/mobi-preview.types'

function key(jobId: string): string {
  return `mobi:preview:status:${jobId}`
}

/**
 * Armazena estado live da extracao de preview MOBI em Hash via {@link IStatusStore}.
 * Default: `InMemoryStatusStore` no modo embedded (`env.MI_EMBEDDED_MODE`),
 * `RedisStatusStoreAdapter` (lazy) no modo web. Injeção explícita sobrepõe.
 *
 * Reusa `JOB_STATUS_TTL_SEC` (mesma janela das Conversion Jobs) — preview e
 * efemero: se ninguem escuta por 6h, regsdescarta. O cache em /temp tem TTL
 * proprio (`MOBI_PREVIEW_TTL_SEC`, default 24h), gerenciado pelo
 * `MobiPreviewService`.
 */
export class MobiPreviewStatusStore {
  constructor(
    private readonly store: IStatusStore = env.MI_EMBEDDED_MODE
      ? new InMemoryStatusStore()
      : new RedisStatusStoreAdapter(),
  ) {}

  async set(jobId: string, partial: Partial<MobiPreviewLiveState>): Promise<void> {
    const flat: Record<string, string | number> = {}
    for (const [field, value] of Object.entries(partial)) {
      if (value !== undefined && value !== null) {
        flat[field] = value
      }
    }
    if (Object.keys(flat).length === 0) return
    await this.store.set(key(jobId), flat, env.JOB_STATUS_TTL_SEC)
  }

  async get(jobId: string): Promise<MobiPreviewLiveState | null> {
    const data = await this.store.get(key(jobId))
    if (!data) return null

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
    await this.store.clear(key(jobId))
  }
}
