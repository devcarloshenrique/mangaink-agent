import type { FastifyReply, FastifyRequest } from 'fastify'
import { GetChapterPagesUseCase } from '../use-cases/get-chapter-pages.use-case'

interface ChapterParams {
  sourceId: string
  chapterId: string
}

const useCase = new GetChapterPagesUseCase()

export async function getChapterPages(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { sourceId, chapterId } = request.params as ChapterParams

  const result = await useCase.execute(sourceId, chapterId)

  return reply.send(result)
}
