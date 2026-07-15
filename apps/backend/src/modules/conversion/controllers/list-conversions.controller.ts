import type { FastifyReply, FastifyRequest } from 'fastify'
import type { ListConversionsUseCase } from '../use-cases/list-conversions.use-case'
import type { ListConversionsQuery } from '../dtos/list-conversions.dto'

export function listConversionsHandler(useCase: ListConversionsUseCase) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const userId = (request.user as { sub: string }).sub
    const query = request.query as ListConversionsQuery
    const result = await useCase.execute(userId, query)
    return reply.send(result)
  }
}