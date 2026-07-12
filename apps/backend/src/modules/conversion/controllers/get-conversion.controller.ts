import type { FastifyReply, FastifyRequest } from 'fastify'
import type { GetConversionUseCase } from '../use-cases/get-conversion.use-case'

export function getConversionHandler(useCase: GetConversionUseCase) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const { conversionId } = request.params as { conversionId: string }
    const userId = (request.user as { sub: string }).sub
    const state = await useCase.execute(conversionId, userId)
    return reply.send(state)
  }
}