import type { IStatusStore } from '../status-store.service'

interface StatusEntry {
  fields: Record<string, string>
  expiresAt?: number
}

/**
 * StatusStore in-memory por chave — implementação embedded (desktop) do IStatusStore.
 * Substitui o Redis Hash (HSET/HGETALL/EXPIRE) quando não há infraestrutura externa.
 *
 * Semântica de Hash:
 * - `set` faz merge parcial de campos: campos não informados são preservados e
 *   valores `undefined` são ignorados (não gravados, não removem campo existente).
 * - `get` devolve `null` se a key não existe ou está expirada.
 * - `clear` remove a chave inteira.
 *
 * Expiração é lazy: o TTL (em ms) é verificado no acesso via Date.now(). Uma key
 * expirada é removida — `get` passa a devolver `null`.
 * TTL: se `ttlSeconds` for informado, o TTL é setado/resetado (o último `set` com
 * ttl vence); um `set` sem ttl NÃO cancela um TTL existente (espelhando o EXPIRE
 * do Redis, que não é removido por um HSET subsequente sem EXPIRE).
 */
export class InMemoryStatusStore implements IStatusStore {
  private readonly entries = new Map<string, StatusEntry>()

  private entry(key: string): StatusEntry | undefined {
    const entry = this.entries.get(key)
    if (!entry) return undefined
    if (entry.expiresAt !== undefined && entry.expiresAt <= Date.now()) {
      this.entries.delete(key)
      return undefined
    }
    return entry
  }

  async get(key: string): Promise<Record<string, string> | null> {
    const entry = this.entry(key)
    if (!entry) return null
    return { ...entry.fields }
  }

  async set(
    key: string,
    partial: Record<string, string | number | undefined>,
    ttlSeconds?: number,
  ): Promise<void> {
    let entry = this.entry(key)
    if (!entry) {
      entry = { fields: {} }
      this.entries.set(key, entry)
    }
    for (const [field, value] of Object.entries(partial)) {
      if (value === undefined) continue
      entry.fields[field] = String(value)
    }
    if (ttlSeconds !== undefined) {
      entry.expiresAt = Date.now() + ttlSeconds * 1000
    }
  }

  async clear(key: string): Promise<void> {
    this.entries.delete(key)
  }
}
