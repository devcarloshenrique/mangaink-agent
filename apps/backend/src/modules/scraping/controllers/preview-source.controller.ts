import type { FastifyReply, FastifyRequest } from 'fastify'
import type { SourceParams } from '../dtos/preview-source.dto'
import { GetSourceUseCase } from '../use-cases/get-source.use-case'
import { getSourceRepository } from '../../../shared/database/repositories'
import { getUserChapterProgressRepository } from '../../../shared/database/repositories'
import { SourceNotFoundError } from '../errors/scraping.errors'

export async function getSource(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { sourceId } = request.params as SourceParams
  const userId = (request.user as { sub?: string } | undefined)?.sub

  const sourceRepo = getSourceRepository()
  const readingRepo = getUserChapterProgressRepository()
  const useCase = new GetSourceUseCase(sourceRepo, readingRepo)

  try {
    const result = await useCase.execute(sourceId, userId)
    return reply.send(result)
  } catch (error) {
    if (error instanceof SourceNotFoundError) {
      return reply.code(404).send({ error: error.message })
    }
    throw error
  }
}
