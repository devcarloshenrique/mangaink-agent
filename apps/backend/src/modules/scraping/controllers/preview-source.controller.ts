import type { FastifyReply, FastifyRequest } from 'fastify'
import type { SourceParams } from '../dtos/preview-source.dto'
import { GetSourceUseCase } from '../use-cases/get-source.use-case'
import { SourceNotFoundError } from '../errors/scraping.errors'

const useCase = new GetSourceUseCase()

export async function getSource(
  request: FastifyRequest<{ Params: SourceParams }>,
  reply: FastifyReply,
) {
  const { sourceId } = request.params

  try {
    const result = await useCase.execute(sourceId)
    return reply.send(result)
  } catch (error) {
    if (error instanceof SourceNotFoundError) {
      return reply.code(404).send({ error: error.message })
    }
    throw error
  }
}
