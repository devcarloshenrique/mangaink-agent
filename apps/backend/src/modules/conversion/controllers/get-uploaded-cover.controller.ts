import { createReadStream } from 'node:fs'
import type { FastifyReply, FastifyRequest } from 'fastify'
import type { GetUploadedCoverUseCase } from '../use-cases/get-uploaded-cover.use-case'
import type { UploadedCoverParams } from '../dtos/upload-cover.dto'

export function getUploadedCoverHandler(useCase: GetUploadedCoverUseCase) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const { uploadId } = request.params as UploadedCoverParams

    const { filePath, contentType } = await useCase.execute(uploadId)

    reply.header('Content-Type', contentType)
    reply.header('Cache-Control', 'public, max-age=86400, immutable')
    return reply.send(createReadStream(filePath))
  }
}
