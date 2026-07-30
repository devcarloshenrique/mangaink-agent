import type { FastifyReply, FastifyRequest } from 'fastify'
import type { ReadingParams, BatchMarkReadBody } from '../dtos/reading.dto'
import { BatchMarkReadUseCase } from '../use-cases/batch-mark-read.use-case'
import { getUserChapterProgressRepository } from '../../../shared/database/repositories'

export async function batchMarkRead(
  request: FastifyRequest<{ Params: ReadingParams; Body: BatchMarkReadBody }>,
  reply: FastifyReply,
) {
  const { sourceId } = request.params
  const { chapterIds, markAsRead } = request.body
  const userId = request.user!.sub

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
