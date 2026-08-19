import { describe, it, expect, vi } from 'vitest'
import { LogoutUserUseCase } from '../../use-cases/logout.use-case'
import type { TokenDenylist } from '../../services/token-denylist'

describe('LogoutUserUseCase', () => {
  it('deve revogar o jti com o TTL informado', async () => {
    const denylist: TokenDenylist = {
      revoke: vi.fn(async () => {}),
      isRevoked: vi.fn(async () => false),
    }
    const useCase = new LogoutUserUseCase(denylist)

    const result = await useCase.execute({ jti: 'jti-1', ttlSeconds: 3600 })

    expect(denylist.revoke).toHaveBeenCalledWith('jti-1', 3600)
    expect(result).toEqual({ revoked: true })
  })
})
