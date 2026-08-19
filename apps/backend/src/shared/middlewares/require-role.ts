import type { FastifyReply, FastifyRequest } from 'fastify'
import type { UserRole } from '../../modules/user/entities/user.entity'

/**
 * Middleware de autorização por papel (RBAC — VULN-02/MEC-52).
 * Deve ser usado junto com `verifyJwt` (que popula `request.user`).
 * Responder 403 quando o papel do usuário é insuficiente; ADMIN passa em
 * qualquer requisito.
 */
export function requireRole(...roles: UserRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as { role?: UserRole } | undefined
    const role = user?.role

    if (!role) {
      return reply.code(403).send({ error: 'Acesso negado' })
    }

    if (role === 'ADMIN' || roles.includes(role)) {
      return
    }

    return reply.code(403).send({ error: 'Acesso negado' })
  }
}
