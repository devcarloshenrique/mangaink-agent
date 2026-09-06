import type { FastifyReply, FastifyRequest } from 'fastify'
import type { AddToLibraryBody } from '../dtos/library.dto'
import { AddToLibraryUseCase } from '../use-cases/add-to-library.use-case'
import { getLibraryRepository, getSourceRepository } from '../../../shared/database/repositories'

export async function addToLibrary(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const userId = (request.user as { sub: string }).sub
  const body = request.body as AddToLibraryBody
  const { sourceId } = body

  const libraryRepo = getLibraryRepository()
  const sourceRepo = getSourceRepository()
  const useCase = new AddToLibraryUseCase(libraryRepo, sourceRepo)

  const result = await useCase.execute({
    userId,
    sourceId,
  })

  return reply.code(200).send(result)
}

