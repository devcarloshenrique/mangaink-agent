import type { FastifyReply, FastifyRequest } from 'fastify'
import type { GetConversionUseCase } from '../use-cases/get-conversion.use-case'
import { ConversionNotFoundError } from '../errors/conversion.errors'

export function getConversionHandler(useCase: GetConversionUseCase) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const { conversionId } = request.params as { conversionId: string }
    try {
      const state = await useCase.execute(conversionId)
      return reply.send(state)
    } catch (error) {
      if (error instanceof ConversionNotFoundError) {
        return reply.code(404).send({ error: error.message })
      }
      throw error
    }
  }
}