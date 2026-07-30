import type { FastifyReply, FastifyRequest } from 'fastify'

export async function verifyJwtOptional(request: FastifyRequest, _reply: FastifyReply) {
  try {
    await request.jwtVerify()
  } catch {
    // Não retorna 401 — apenas continua sem usuário autenticado
    // request.user permanece undefined
  }
}
