import type { FastifyReply, FastifyRequest } from 'fastify'
import type { ConversionEventsService } from '../services/conversion-events.service'
import type { GetConversionUseCase } from '../use-cases/get-conversion.use-case'

export function conversionEventsHandler(
  events: ConversionEventsService,
  getConversionUseCase: GetConversionUseCase,
) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const { conversionId } = request.params as { conversionId: string }
    const userId = (request.user as { sub: string }).sub

    const state = await getConversionUseCase.execute(conversionId, userId)
    const jobIds = state.jobs.map((j) => j.jobId)
    if (jobIds.length === 0) {
      return reply.code(200).send({ warning: 'Conversion sem jobs para seguir' })
    }
    await events.connectConversionToSSE(jobIds, reply)
  }
}