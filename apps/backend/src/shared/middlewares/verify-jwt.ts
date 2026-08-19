import type { FastifyReply, FastifyRequest } from 'fastify'
import { JWT_AUDIENCE, JWT_ISSUER } from '../../modules/auth/services/token.service'
import { getTokenDenylist } from '../../modules/auth/services/token-denylist'

/**
 * Middleware de autenticação JWT (VULN-4 / MEC-80):
 * - valida assinatura e expiração via @fastify/jwt;
 * - exige claims `iss`/`aud` com os valores esperados da app;
 * - exige `jti` e rejeita tokens cujo `jti` esteja na denylist (logout).
 */
export async function verifyJwt(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify({ allowedIss: JWT_ISSUER, allowedAud: JWT_AUDIENCE })

    const jti = (request.user as { jti?: string } | undefined)?.jti
    if (!jti) {
      throw new Error('Token sem claim jti')
    }

    if (await getTokenDenylist().isRevoked(jti)) {
      throw new Error('Token revogado')
    }
  } catch {
    return reply.code(401).send({ error: 'Não autorizado' })
  }
}
