import type { FastifyReply, FastifyRequest } from 'fastify'
import { GetChapterDownloadUseCase } from '../use-cases/get-chapter-download.use-case'

interface ChapterParams {
  sourceId: string
  chapterId: string
}

const useCase = new GetChapterDownloadUseCase()

export async function getChapterDownload(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { sourceId, chapterId } = request.params as ChapterParams

  const result = await useCase.execute(sourceId, chapterId)

  return reply.send(result)
}
