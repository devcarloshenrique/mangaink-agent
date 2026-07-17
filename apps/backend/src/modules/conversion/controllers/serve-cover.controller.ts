import { createReadStream } from 'node:fs'
import type { FastifyReply, FastifyRequest } from 'fastify'
import type { ServeCoverUseCase } from '../use-cases/serve-cover.use-case'
import type { CoverParams } from '../dtos/cover-params.dto'

export function serveCoverHandler(useCase: ServeCoverUseCase) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const { sourceId, coverId } = request.params as CoverParams

    const { filePath, contentType } = await useCase.execute(sourceId, coverId)

    reply.header('Content-Type', contentType)
    reply.header('Cache-Control', 'public, max-age=86400')
    return reply.send(createReadStream(filePath))
  }
}
