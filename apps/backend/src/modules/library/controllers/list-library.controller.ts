import type { FastifyReply, FastifyRequest } from 'fastify'
import type { ListLibraryQuery } from '../dtos/library.dto'
import { ListLibraryUseCase } from '../use-cases/list-library.use-case'
import { getLibraryRepository } from '../../../shared/database/repositories'

export async function listLibrary(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const userId = (request.user as { sub: string }).sub
  const { isFavorite, query } = (request.query as ListLibraryQuery) || {}

  const repo = getLibraryRepository()
  const useCase = new ListLibraryUseCase(repo)

  const result = await useCase.execute({
    userId,
    isFavorite,
    query,
  })

  return reply.code(200).send(result)
}
