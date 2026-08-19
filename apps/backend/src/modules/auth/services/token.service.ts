// Claims de emissão da sessão JWT (VULN-4 / MEC-80)
export const JWT_ISSUER = 'mangaink-agent'
export const JWT_AUDIENCE = 'mangaink-app'
// Sessão de curta duração (7h) — substitui o antigo '15d'
export const SESSION_EXPIRES_IN = '7h'

export type TokenOptions = {
  expiresIn?: string
}

export interface TokenService {
  sign(payload: Record<string, unknown>, options?: TokenOptions): Promise<string>
}

export class JwtTokenService implements TokenService {
  constructor(
    private readonly signFn: (
      payload: Record<string, unknown>,
      options?: TokenOptions,
    ) => Promise<string>,
  ) {}

  sign(payload: Record<string, unknown>, options?: TokenOptions) {
    return this.signFn(payload, options)
  }
}
