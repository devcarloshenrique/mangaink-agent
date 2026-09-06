import type { FastifyReply, FastifyRequest } from 'fastify'
import type { LibraryParams, ToggleFavoriteBody } from '../dtos/library.dto'
import { ToggleFavoriteUseCase } from '../use-cases/toggle-favorite.use-case'
import { getLibraryRepository, getSourceRepository } from '../../../shared/database/repositories'

export async function toggleFavorite(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const userId = (request.user as { sub: string }).sub
  const { sourceId } = request.params as LibraryParams
  const body = (request.body as ToggleFavoriteBody | undefined) || {}
  const { isFavorite } = body

  const libraryRepo = getLibraryRepository()
  const sourceRepo = getSourceRepository()
  const useCase = new ToggleFavoriteUseCase(libraryRepo, sourceRepo)

  const result = await useCase.execute({
    userId,
    sourceId,
    isFavorite,
  })

  return reply.code(200).send(result)
}

