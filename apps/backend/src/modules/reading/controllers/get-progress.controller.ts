import type { FastifyReply, FastifyRequest } from 'fastify'
import type { ReadingParams } from '../dtos/reading.dto'
import { GetProgressUseCase } from '../use-cases/get-progress.use-case'
import { getSourceRepository, getUserChapterProgressRepository } from '../../../shared/database/repositories'

export async function getProgress(
  request: FastifyRequest<{ Params: ReadingParams }>,
  reply: FastifyReply,
) {
  const { sourceId } = request.params
  const userId = request.user!.sub

  const readingRepo = getUserChapterProgressRepository()
  const sourceRepo = getSourceRepository()
  const useCase = new GetProgressUseCase(readingRepo, sourceRepo)

  const result = await useCase.execute({ userId, sourceId })
  return reply.code(200).send(result)
}
