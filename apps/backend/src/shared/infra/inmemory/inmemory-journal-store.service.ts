import type { IJournalStore } from '../journal-store.service'

interface JournalEntry {
  items: string[]
  expiresAt: number | null
  counter: number
}

/**
 * Journal in-memory por chave — implementação embedded (desktop) do IJournalStore.
 * Substitui o Redis (rpush/lrange/incr/expire) quando não há infraestrutura externa.
 *
 * Expiração é lazy: o TTL (em ms) é verificado no acesso via Date.now(). Uma key
 * expirada é removida — `range` volta a devolver `[]` e `nextId` recomeça em 1.
 * Rechamar `expire` redefine o TTL (mesmo comportamento do EXPIRE do Redis).
 */
export class InMemoryJournalStore implements IJournalStore {
  private readonly entries = new Map<string, JournalEntry>()

  private entry(key: string): JournalEntry | undefined {
    const entry = this.entries.get(key)
    if (!entry) return undefined
    if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
      this.entries.delete(key)
      return undefined
    }
    return entry
  }

  private slice(items: string[], start: number, end: number): string[] {
    const len = items.length
    if (len === 0) return []
    let s = start < 0 ? len + start : start
    let e = end < 0 ? len + end : end
    if (s < 0) s = 0
    if (e >= len) e = len - 1
    if (s > e) return []
    return items.slice(s, e + 1)
  }

  async append(key: string, entry: unknown): Promise<void> {
    const current = this.entry(key)
    if (current) {
      current.items.push(JSON.stringify(entry))
      return
    }
    this.entries.set(key, {
      items: [JSON.stringify(entry)],
      expiresAt: null,
      counter: 0,
    })
  }

  async range(key: string, start: number, end: number): Promise<string[]> {
    const entry = this.entry(key)
    if (!entry) return []
    return this.slice(entry.items, start, end)
  }

  async nextId(key: string): Promise<number> {
    const current = this.entry(key)
    if (current) {
      current.counter += 1
      return current.counter
    }
    this.entries.set(key, {
      items: [],
      expiresAt: null,
      counter: 1,
    })
    return 1
  }

  async expire(key: string, seconds: number): Promise<void> {
    const entry = this.entry(key)
    if (!entry) return
    entry.expiresAt = Date.now() + seconds * 1000
  }
}
