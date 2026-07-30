import type { FastifyReply, FastifyRequest } from 'fastify'
import type { ReadingChapterParams } from '../dtos/reading.dto'
import { UnmarkReadUseCase } from '../use-cases/unmark-read.use-case'
import { getUserChapterProgressRepository } from '../../../shared/database/repositories'

export async function unmarkRead(
  request: FastifyRequest<{ Params: ReadingChapterParams }>,
  reply: FastifyReply,
) {
  const { sourceId, chapterId } = request.params
  const userId = request.user!.sub

  const repo = getUserChapterProgressRepository()
  const useCase = new UnmarkReadUseCase(repo)

  const result = await useCase.execute({ userId, sourceId, chapterId })
  return reply.code(200).send(result)
}
