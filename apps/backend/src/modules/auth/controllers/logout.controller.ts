import type { FastifyReply, FastifyRequest } from 'fastify'
import { getTokenDenylist } from '../services/token-denylist'
import { clearAuthCookie } from '../services/auth-cookie'
import { LogoutUserUseCase } from '../use-cases/logout.use-case'

const SESSION_TTL_SECONDS = 7 * 60 * 60 // 7h — fallback se o token não expuser `exp`

export async function logout(request: FastifyRequest, reply: FastifyReply) {
  // verifyJwt (onRequest) já garantiu token válido e não revogado
  const user = request.user as { jti?: string; exp?: number } | undefined
  const jti = user?.jti

  if (!jti) {
    return reply.code(401).send({ error: 'Não autorizado' })
  }

  const ttlSeconds = user.exp
    ? Math.max(1, user.exp - Math.floor(Date.now() / 1000))
    : SESSION_TTL_SECONDS

  const useCase = new LogoutUserUseCase(getTokenDenylist())
  await useCase.execute({ jti, ttlSeconds })

  clearAuthCookie(reply)

  return reply.code(204).send()
}
