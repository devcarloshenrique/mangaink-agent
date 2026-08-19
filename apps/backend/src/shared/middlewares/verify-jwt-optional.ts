import type { FastifyReply, FastifyRequest } from 'fastify'
import { JWT_AUDIENCE, JWT_ISSUER } from '../../modules/auth/services/token.service'
import { getTokenDenylist } from '../../modules/auth/services/token-denylist'

/**
 * Auth opcional: valida o token quando presente (iss/aud/jti e denylist),
 * mas nunca bloqueia — sem token (ou token inválido/revogado) a rota segue
 * sem usuário autenticado.
 */
export async function verifyJwtOptional(request: FastifyRequest, _reply: FastifyReply) {
  try {
    await request.jwtVerify({ allowedIss: JWT_ISSUER, allowedAud: JWT_AUDIENCE })

    const jti = (request.user as { jti?: string } | undefined)?.jti
    if (!jti || (await getTokenDenylist().isRevoked(jti))) {
      // Não trata como autenticado — continua sem usuário
      request.user = undefined as never
    }
  } catch {
    // Não retorna 401 — apenas continua sem usuário autenticado
    // request.user permanece undefined
  }
}
