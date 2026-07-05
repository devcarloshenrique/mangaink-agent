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
