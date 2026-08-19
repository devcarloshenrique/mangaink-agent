import type { IStatusStore } from '../../../shared/infra'
import { RedisStatusStoreAdapter } from '../../../shared/infra/redis'

const PREFIX = 'source-inspect-owner:'
const TTL = 86400 // 24h

let _store: IStatusStore | null = null

function getStore(): IStatusStore {
  if (!_store) {
    _store = new RedisStatusStoreAdapter()
  }
  return _store
}

/**
 * Injeta a implementação de {@link IStatusStore} usada pelo registro de dono
 * das inspeções. Usado pelo composition root para trocar o Redis por
 * `InMemoryStatusStore` no modo embedded (desktop). Sem chamada, o default é o
 * adapter Redis lazy.
 */
export function setInspectOwnerStatusStore(store: IStatusStore): void {
  _store = store
}

function key(sourceId: string): string {
  return `${PREFIX}${sourceId}`
}

/**
 * Registra o dono (userId) de uma inspeção em andamento para um sourceId.
 * Usado pelo POST /inspect ao enfileirar o job. TTL de 24h como fallback caso
 * o worker não consiga limpar (crash).
 */
export async function setInspectOwner(sourceId: string, userId: string): Promise<void> {
  await getStore().set(key(sourceId), { userId }, TTL)
}

/**
 * Retorna o dono (userId) de uma inspeção em andamento, ou null se não houver.
 */
export async function getInspectOwner(sourceId: string): Promise<string | null> {
  const data = await getStore().get(key(sourceId))
  if (!data || Object.keys(data).length === 0) return null
  return data.userId ?? null
}

/**
 * Remove o registro de dono após o worker concluir/falhar a inspeção.
 */
export async function clearInspectOwner(sourceId: string): Promise<void> {
  await getStore().clear(key(sourceId))
}
