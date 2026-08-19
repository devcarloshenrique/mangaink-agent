import type Redis from 'ioredis'
import { env } from '../../../shared/config/env'
import { getRedis } from '../../../shared/redis/redis'
import { logger } from '../../../shared/logging/logger'

/**
 * Denylist de tokens JWT por `jti` (identificador único de sessão).
 * Usada pelo logout server-side para revogar sessões (VULN-4 / MEC-80).
 */
export interface TokenDenylist {
  revoke(jti: string, ttlSeconds: number): Promise<void>
  isRevoked(jti: string): Promise<boolean>
}

/**
 * Implementação em memória — fallback documentado quando Redis não está
 * disponível (modo embedded do desktop) ou em testes. Expiração é lazy: a
 * entrada expirada é removida na primeira verificação após o TTL.
 */
export class InMemoryTokenDenylist implements TokenDenylist {
  private readonly revokedAt = new Map<string, number>()

  async revoke(jti: string, ttlSeconds: number): Promise<void> {
    this.revokedAt.set(jti, Date.now() + ttlSeconds * 1000)
  }

  async isRevoked(jti: string): Promise<boolean> {
    const expiresAt = this.revokedAt.get(jti)
    if (expiresAt === undefined) return false
    if (expiresAt <= Date.now()) {
      this.revokedAt.delete(jti)
      return false
    }
    return true
  }

  /** Limpa a denylist (útil em testes). */
  clear(): void {
    this.revokedAt.clear()
  }
}

const DENYLIST_PREFIX = 'jwt-denylist:'

/**
 * Implementação Redis — preferida no modo web.
 *
 * A revogação é sempre gravada no fallback em memória (fonte de verdade local
 * do processo) e espelhada no Redis (best-effort) para invalidar a sessão em
 * outros processos/instâncias. Se o Redis estiver indisponível (status !=
 * ready ou comando falhou), a revogação continua valendo dentro do processo,
 * sem bloquear o request.
 */
export class RedisTokenDenylist implements TokenDenylist {
  constructor(
    private readonly redis: Redis,
    private readonly fallback: TokenDenylist = new InMemoryTokenDenylist(),
  ) {}

  async revoke(jti: string, ttlSeconds: number): Promise<void> {
    await this.fallback.revoke(jti, ttlSeconds)
    if (this.redis.status !== 'ready') {
      return
    }
    try {
      await this.redis.set(DENYLIST_PREFIX + jti, '1', 'EX', ttlSeconds)
    } catch (error) {
      logger.warn(
        { err: (error as Error).message },
        '[TokenDenylist] Redis indisponivel — revogacao mantida em memoria',
      )
    }
  }

  async isRevoked(jti: string): Promise<boolean> {
    if (await this.fallback.isRevoked(jti)) {
      return true
    }
    if (this.redis.status !== 'ready') {
      return false
    }
    try {
      return (await this.redis.exists(DENYLIST_PREFIX + jti)) === 1
    } catch (error) {
      logger.warn(
        { err: (error as Error).message },
        '[TokenDenylist] Redis indisponivel — verificacao em memoria',
      )
      return false
    }
  }
}

/**
 * Seleciona a implementação:
 * - teste / modo embedded → em memória (sem Redis).
 * - modo web → Redis com fallback em memória.
 */
export function createTokenDenylist(): TokenDenylist {
  if (env.NODE_ENV === 'test' || env.MI_EMBEDDED_MODE) {
    return new InMemoryTokenDenylist()
  }
  return new RedisTokenDenylist(getRedis())
}

let _denylist: TokenDenylist | null = null

/**
 * Instância compartilhada entre o middleware verify-jwt e o logout.
 * Sem chamada explícita a {@link setTokenDenylist}, cria uma por demanda.
 */
export function getTokenDenylist(): TokenDenylist {
  if (!_denylist) {
    _denylist = createTokenDenylist()
  }
  return _denylist
}

/**
 * Injeta a implementação usada pelo middleware/logout. Chamado pelo
 * composition root (server.ts) — mesmo padrão de setChapterDownloadStatusStore.
 */
export function setTokenDenylist(denylist: TokenDenylist): void {
  _denylist = denylist
}
