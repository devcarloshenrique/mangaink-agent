import '@fastify/jwt'

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      sub?: string
      username?: string
      role?: 'USER' | 'ADMIN'
      jti?: string
      iss?: string
      aud?: string
      [key: string]: unknown
    }
    user: {
      sub: string
      username: string
      role: 'USER' | 'ADMIN'
      jti?: string
      iss?: string
      aud?: string
    }
  }
}

