import type { TokenDenylist } from '../services/token-denylist'

export interface LogoutUserInput {
  jti: string
  /** Tempo restante de validade do token (segundos) — mantém o jti na denylist até expirar. */
  ttlSeconds: number
}

export class LogoutUserUseCase {
  constructor(private readonly tokenDenylist: TokenDenylist) {}

  async execute(input: LogoutUserInput): Promise<{ revoked: true }> {
    await this.tokenDenylist.revoke(input.jti, input.ttlSeconds)
    return { revoked: true }
  }
}
