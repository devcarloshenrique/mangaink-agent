import type { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { CreateChapterDownloadUseCase } from '../use-cases/create-chapter-download.use-case'

interface ChapterParams {
  sourceId: string
  chapterId: string
}

/**
 * Body opcional — a rota aceita chamadas SEM payload (por isso não há
 * `body` no schema da rota). Quando presente, é validado aqui: o `batchId`
 * vai para o payload da fila BullMQ, então precisa de limite de tamanho.
 */
const chapterDownloadBodySchema = z.object({
  batchId: z.string().min(1).max(100).optional(),
})

const useCase = new CreateChapterDownloadUseCase()

export async function createChapterDownload(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { sourceId, chapterId } = request.params as ChapterParams
  const userId = (request.user as { sub: string }).sub

  const parsed = chapterDownloadBodySchema.safeParse(request.body ?? {})
  if (!parsed.success) {
    return reply.code(400).send({ error: 'Body inválido: batchId deve ser uma string (1–100 caracteres).' })
  }

  const result = await useCase.execute({
    sourceId,
    chapterId,
    userId,
    batchId: parsed.data.batchId,
  })

  if (result.status === 'ready') {
    return reply.code(200).send(result)
  }

  return reply.code(202).send(result)
}
