import type { FastifyReply, FastifyRequest } from 'fastify'
import type { UploadCoverUseCase } from '../use-cases/upload-cover.use-case'
import type { UploadCoverBody } from '../dtos/upload-cover.dto'

export function uploadCoverHandler(useCase: UploadCoverUseCase) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const body = request.body as UploadCoverBody
    // verifyJwt garante request.user com sub — mesmo padrão dos demais controllers
    const sessionUser: { sub: string } = request.user as { sub: string }
    const result = await useCase.execute(body, sessionUser.sub)
    return reply.status(201).send(result)
  }
}
