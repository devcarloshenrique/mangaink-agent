import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  InMemoryTokenDenylist,
  RedisTokenDenylist,
} from '../../services/token-denylist'

describe('InMemoryTokenDenylist', () => {
  let denylist: InMemoryTokenDenylist

  beforeEach(() => {
    denylist = new InMemoryTokenDenylist()
  })

  it('deve revogar um jti e reportar isRevoked=true', async () => {
    await denylist.revoke('jti-1', 3600)
    expect(await denylist.isRevoked('jti-1')).toBe(true)
  })

  it('deve reportar isRevoked=false para jti nunca revogado', async () => {
    expect(await denylist.isRevoked('jti-inexistente')).toBe(false)
  })

  it('deve expirar a revogação após o TTL (lazy cleanup)', async () => {
    await denylist.revoke('jti-1', 0)
    expect(await denylist.isRevoked('jti-1')).toBe(false)
  })

  it('deve permitir revogar múltiplos jtis de forma independente', async () => {
    await denylist.revoke('jti-1', 3600)
    await denylist.revoke('jti-2', 3600)
    expect(await denylist.isRevoked('jti-1')).toBe(true)
    expect(await denylist.isRevoked('jti-2')).toBe(true)
    expect(await denylist.isRevoked('jti-3')).toBe(false)
  })
})

describe('RedisTokenDenylist', () => {
  const makeRedis = (status: string, impl?: Record<string, unknown>) => {
    const redis = {
      status,
      set: vi.fn(async () => 'OK'),
      exists: vi.fn(async () => 0),
      ...impl,
    }
    return redis
  }

  it('deve revogar via Redis SETEX quando a conexão está pronta', async () => {
    const redis = makeRedis('ready')
    const denylist = new RedisTokenDenylist(redis as never)

    await denylist.revoke('jti-1', 300)

    expect(redis.set).toHaveBeenCalledWith('jwt-denylist:jti-1', '1', 'EX', 300)
    expect(await denylist.isRevoked('jti-1')).toBe(true)
  })

  it('deve reportar isRevoked=true quando o EXISTS retorna 1 (jti de outra instância)', async () => {
    const redis = makeRedis('ready', { exists: vi.fn(async () => 1) })
    const denylist = new RedisTokenDenylist(redis as never)

    expect(await denylist.isRevoked('jti-remoto')).toBe(true)
    expect(redis.exists).toHaveBeenCalledWith('jwt-denylist:jti-remoto')
  })

  it('deve usar o fallback em memória quando o Redis não está pronto', async () => {
    const redis = makeRedis('connecting')
    const fallback = new InMemoryTokenDenylist()
    const denylist = new RedisTokenDenylist(redis as never, fallback)

    await denylist.revoke('jti-1', 300)

    expect(redis.set).not.toHaveBeenCalled()
    expect(await denylist.isRevoked('jti-1')).toBe(true)
  })

  it('deve usar o fallback em memória quando o comando Redis falha', async () => {
    const redis = makeRedis('ready', {
      set: vi.fn(async () => {
        throw new Error('connection refused')
      }),
    })
    const fallback = new InMemoryTokenDenylist()
    const denylist = new RedisTokenDenylist(redis as never, fallback)

    await denylist.revoke('jti-1', 300)

    expect(await denylist.isRevoked('jti-1')).toBe(true)
  })
})
