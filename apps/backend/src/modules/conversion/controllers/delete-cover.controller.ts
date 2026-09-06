import type { FastifyReply, FastifyRequest } from 'fastify'
import type { DeleteCoverUseCase } from '../use-cases/delete-cover.use-case'
import type { DeleteCoverParams } from '../dtos/delete-cover.dto'

export function deleteCoverHandler(useCase: DeleteCoverUseCase) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const { coverId } = request.params as DeleteCoverParams
    // verifyJwt garante request.user com sub — mesmo padrão dos demais controllers
    const sessionUser: { sub: string } = request.user as { sub: string }
    const result = await useCase.execute(coverId, sessionUser.sub)
    return reply.code(200).send(result)
  }
}
