import type { FastifyReply, FastifyRequest } from 'fastify'
import { CreateChapterDownloadUseCase } from '../use-cases/create-chapter-download.use-case'

interface ChapterParams {
  sourceId: string
  chapterId: string
}

const useCase = new CreateChapterDownloadUseCase()

export async function createChapterDownload(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { sourceId, chapterId } = request.params as ChapterParams

  const result = await useCase.execute(sourceId, chapterId)

  if (result.status === 'ready') {
    return reply.code(200).send(result)
  }

  return reply.code(202).send(result)
}
