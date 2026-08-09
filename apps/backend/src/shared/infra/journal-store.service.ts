/**
 * Contratos de journal — log por chave com IDs monotônicos e TTL.
 * Usado para replay de eventos SSE para clientes que conectam tardiamente.
 */
export interface IJournalStore {
  append(key: string, entry: unknown): Promise<void>
  range(key: string, start: number, end: number): Promise<string[]>
  nextId(key: string): Promise<number>
  expire(key: string, seconds: number): Promise<void>
}
