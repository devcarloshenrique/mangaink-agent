import type { FastifyReply, FastifyRequest } from 'fastify'
import { PrismaUserRepository } from '../../user/repositories/prisma-user.repository'
import { GetMeUseCase } from '../use-cases/get-me.use-case'

export async function me(request: FastifyRequest, reply: FastifyReply) {
  const userRepository = new PrismaUserRepository()
  const useCase = new GetMeUseCase(userRepository)

  try {
    const user = await useCase.execute((request.user as { sub: string }).sub)
    return reply.send(user)
  } catch {
    return reply.code(401).send({ error: 'Não autorizado' })
  }
}
