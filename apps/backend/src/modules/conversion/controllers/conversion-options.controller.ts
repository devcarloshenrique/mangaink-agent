import type { FastifyReply, FastifyRequest } from 'fastify'
import { GetConversionOptionsUseCase } from '../use-cases/get-conversion-options.use-case'

const getOptions = new GetConversionOptionsUseCase()

export async function conversionOptionsHandler(
  _request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const options = getOptions.execute()
  return reply.send(options)
}