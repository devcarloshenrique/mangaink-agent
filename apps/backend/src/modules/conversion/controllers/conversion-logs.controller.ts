import type { FastifyReply, FastifyRequest } from 'fastify'
import type { GetConversionLogsUseCase } from '../use-cases/get-conversion-logs.use-case'

export function conversionLogsHandler(logsUseCase: GetConversionLogsUseCase) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const { conversionId } = request.params as { conversionId: string }
    const userId = (request.user as { sub: string }).sub

    const entries = await logsUseCase.execute(conversionId, userId)
    return reply.code(200).send(entries)
  }
}
