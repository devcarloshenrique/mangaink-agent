import type { ILockService } from '../lock.service'

interface LockEntry {
  ownerId: string
  expiresAt: number
}

export interface InMemoryLockOptions {
  /** TTL do lock em milissegundos (padrão: 120s, espelhando o RedisLockService). */
  ttlMs?: number
}

/**
 * Lock distribuído in-memory — implementação embedded (desktop) do ILockService.
 * Substitui o Redis SET NX EX + Lua do RedisLockService quando não há infraestrutura externa.
 *
 * Semântica espelhada do Redis:
 * - `acquire` (SET NX EX): só adquire se a key não existe ou está expirada. NÃO há
 *   reentrância — um segundo acquire da mesma instância também devolve `false`.
 * - `release` (Lua comparando workerId): só remove se o detentor atual é ESTA instância;
 *   caso contrário é no-op (não lança).
 * - `isLocked` (GET): `true` enquanto o lock está ativo e não expirado.
 *
 * O armazenamento é um Map compartilhado em nível de módulo (espelhando o Redis, que
 * é externo e compartilhado entre instâncias). Cada instância tem seu próprio ownerId
 * (workerId), replicando a comparação do release Lua.
 *
 * Expiração é lazy: o TTL é verificado no acesso via Date.now(). Uma entrada expirada
 * é removida — `isLocked` devolve `false` e o próximo `acquire` tem sucesso.
 */
const sharedEntries = new Map<string, LockEntry>()

/**
 * Remove todos os locks compartilhados. Usado como hook de teardown em testes
 * (o estado compartilhado é de módulo) e em encerramento de ciclo de vida.
 */
export function clearSharedLockEntries(): void {
  sharedEntries.clear()
}

export class InMemoryLockService implements ILockService {
  private readonly ttlMs: number
  private readonly ownerId: string

  constructor(options: InMemoryLockOptions = {}) {
    this.ttlMs = options.ttlMs ?? 120_000
    this.ownerId = `worker-${Math.random().toString(36).slice(2)}`
  }

  private entry(key: string): LockEntry | undefined {
    const entry = sharedEntries.get(key)
    if (!entry) return undefined
    if (entry.expiresAt <= Date.now()) {
      sharedEntries.delete(key)
      return undefined
    }
    return entry
  }

  async acquire(key: string): Promise<boolean> {
    if (this.entry(key)) return false
    sharedEntries.set(key, {
      ownerId: this.ownerId,
      expiresAt: Date.now() + this.ttlMs,
    })
    return true
  }

  async release(key: string): Promise<void> {
    const entry = this.entry(key)
    if (entry && entry.ownerId === this.ownerId) {
      sharedEntries.delete(key)
    }
  }

  async isLocked(key: string): Promise<boolean> {
    return this.entry(key) !== undefined
  }
}
