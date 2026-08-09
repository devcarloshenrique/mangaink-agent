/**
 * Contratos de status — semântica de Hash (merge parcial de campos, estilo HSET/HGETALL).
 * Desacoplado do Redis para suportar o modo embedded (desktop).
 */
export interface IStatusStore {
  get(key: string): Promise<Record<string, string> | null>
  set(
    key: string,
    partial: Record<string, string | number | undefined>,
    ttlSeconds?: number,
  ): Promise<void>
  clear(key: string): Promise<void>
}
