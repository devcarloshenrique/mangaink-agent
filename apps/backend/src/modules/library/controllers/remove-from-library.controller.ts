import type { FastifyReply, FastifyRequest } from 'fastify'
import type { LibraryParams } from '../dtos/library.dto'
import { RemoveFromLibraryUseCase } from '../use-cases/remove-from-library.use-case'
import { getLibraryRepository } from '../../../shared/database/repositories'

export async function removeFromLibrary(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const userId = (request.user as { sub: string }).sub
  const { sourceId } = request.params as LibraryParams

  const repo = getLibraryRepository()
  const useCase = new RemoveFromLibraryUseCase(repo)

  const result = await useCase.execute({
    userId,
    sourceId,
  })

  return reply.code(200).send(result)
}
