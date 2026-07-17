import type { FastifyReply, FastifyRequest } from 'fastify'
import type { DeleteConversionUseCase } from '../use-cases/delete-conversion.use-case'

export function deleteConversionHandler(useCase: DeleteConversionUseCase) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const { conversionId } = request.params as { conversionId: string }
    const userId = (request.user as { sub: string }).sub
    const result = await useCase.execute(conversionId, userId)
    return reply.send(result)
  }
}
