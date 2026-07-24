import type { FastifyReply, FastifyRequest } from 'fastify'
import { ServeChapterImageUseCase } from '../use-cases/serve-chapter-image.use-case'

interface ServeImageParams {
  sourceId: string
  chapterId: string
  index: string
}

const useCase = new ServeChapterImageUseCase()

export async function serveChapterImage(
  request: FastifyRequest<{ Params: ServeImageParams }>,
  reply: FastifyReply,
) {
  const { sourceId, chapterId, index } = request.params
  const pageIndex = parseInt(index, 10)

  const result = await useCase.execute(sourceId, chapterId, pageIndex)

  const cacheControl = result.isCached
    ? 'public, max-age=86400, immutable'
    : 'no-cache'

  return reply
    .header('Content-Type', result.contentType)
    .header('Cache-Control', cacheControl)
    .send(result.buffer)
}
