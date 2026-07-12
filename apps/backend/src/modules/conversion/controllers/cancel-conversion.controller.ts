import type { FastifyReply, FastifyRequest } from 'fastify'
import type { CancelConversionUseCase } from '../use-cases/cancel-conversion.use-case'

export function cancelConversionHandler(useCase: CancelConversionUseCase) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const { conversionId } = request.params as { conversionId: string }
    const userId = (request.user as { sub: string }).sub
    const result = await useCase.execute(conversionId, userId)
    return reply.send(result)
  }
}