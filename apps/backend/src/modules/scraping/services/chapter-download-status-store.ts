import type { IStatusStore } from '../../../shared/infra'
import { RedisStatusStoreAdapter } from '../../../shared/infra/redis'

const PREFIX = 'chapter-download-active:'
const TTL = 86400 // 24h

let _store: IStatusStore | null = null

function getStore(): IStatusStore {
  if (!_store) {
    _store = new RedisStatusStoreAdapter()
  }
  return _store
}

/**
 * Injeta a implementação de {@link IStatusStore} usada pelas funções abaixo.
 * Usado pelo composition root para trocar o Redis por InMemoryStatusStore
 * no modo embedded (desktop). Sem chamada, o default é o adapter Redis lazy.
 */
export function setChapterDownloadStatusStore(store: IStatusStore): void {
  _store = store
}

function key(sourceId: string, chapterId: string): string {
  return `${PREFIX}${sourceId}:${chapterId}`
}

/**
 * Armazena o status de um job de download no StatusStore (Hash).
 * Usado pelo worker (start/completed/failed) e pelo POST /download (idempotência).
 * `error` é preenchido pelo worker quando status = 'failed' — alimenta a
 * notificação agregada de lote (motivo por capítulo).
 */
export async function setJobStatus(
  sourceId: string,
  chapterId: string,
  jobId: string,
  status: string,
  error?: string,
): Promise<void> {
  await getStore().set(
    key(sourceId, chapterId),
    { jobId, status, ...(error ? { error } : {}) },
    TTL,
  )
}

/**
 * Recupera o status de um job de download do StatusStore (Hash).
 * Retorna null se não existir registro ativo.
 */
export async function getJobStatus(
  sourceId: string,
  chapterId: string,
): Promise<{ jobId: string; status: string; error?: string } | null> {
  const data = await getStore().get(key(sourceId, chapterId))
  if (!data || Object.keys(data).length === 0) return null
  return {
    jobId: data.jobId,
    status: data.status,
    ...(data.error ? { error: String(data.error) } : {}),
  }
}
