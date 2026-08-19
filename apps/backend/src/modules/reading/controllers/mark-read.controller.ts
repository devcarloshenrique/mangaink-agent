import type { FastifyReply, FastifyRequest } from 'fastify'
import type { ReadingChapterParams } from '../dtos/reading.dto'
import { MarkReadUseCase } from '../use-cases/mark-read.use-case'
import { getSourceRepository } from '../../../shared/database/repositories'
import { getUserChapterProgressRepository } from '../../../shared/database/repositories'
import { SourceNotFoundError } from '../../scraping/errors/scraping.errors'

export async function markRead(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { sourceId, chapterId } = request.params as ReadingChapterParams
  const userId = (request.user as { sub: string }).sub

  const sourceRepo = getSourceRepository()
  const source = await sourceRepo.load(sourceId)
  if (!source) {
    throw new SourceNotFoundError(sourceId)
  }

  const repo = getUserChapterProgressRepository()
  const useCase = new MarkReadUseCase(repo)

  const result = await useCase.execute({ userId, sourceId, chapterId })
  return reply.code(200).send(result)
}
