import type { FastifyReply, FastifyRequest } from 'fastify'
import type { ReadingParams, BatchMarkReadBody } from '../dtos/reading.dto'
import { BatchMarkReadUseCase } from '../use-cases/batch-mark-read.use-case'
import { getUserChapterProgressRepository } from '../../../shared/database/repositories'

export async function batchMarkRead(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { sourceId } = request.params as ReadingParams
  const { chapterIds, markAsRead } = request.body as BatchMarkReadBody
  const userId = (request.user as { sub: string }).sub

  const repo = getUserChapterProgressRepository()
  const useCase = new BatchMarkReadUseCase(repo)

  const result = await useCase.execute({
    userId,
    sourceId,
    chapterIds,
    markAsRead,
  })

  return reply.code(200).send(result)
}
