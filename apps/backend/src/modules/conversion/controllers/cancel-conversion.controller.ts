import type { FastifyReply, FastifyRequest } from 'fastify'
import type { CancelConversionUseCase } from '../use-cases/cancel-conversion.use-case'
import { ConversionNotFoundError, InvalidConversionStateError } from '../errors/conversion.errors'

export function cancelConversionHandler(useCase: CancelConversionUseCase) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const { conversionId } = request.params as { conversionId: string }
    try {
      const result = await useCase.execute(conversionId)
      return reply.send(result)
    } catch (error) {
      if (error instanceof ConversionNotFoundError) {
        return reply.code(404).send({ error: error.message })
      }
      if (error instanceof InvalidConversionStateError) {
        return reply.code(409).send({ error: error.message })
      }
      throw error
    }
  }
}