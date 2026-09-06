import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { verifyJwt } from '../../shared/middlewares/verify-jwt'
import {
  listLibraryQuerySchema,
  listLibraryResponseSchema,
  addToLibraryBodySchema,
  libraryParamsSchema,
  toggleFavoriteBodySchema,
  userLibrarySchema,
  removeFromLibraryResponseSchema,
} from './dtos/library.dto'
import { listLibrary } from './controllers/list-library.controller'
import { addToLibrary } from './controllers/add-to-library.controller'
import { removeFromLibrary } from './controllers/remove-from-library.controller'
import { toggleFavorite } from './controllers/toggle-favorite.controller'

export const libraryRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/api/library',
    {
      preHandler: [verifyJwt],
      schema: {
        tags: ['Library'],
        summary: 'Listar obras da biblioteca do usuário',
        description: 'Retorna todas as obras salvas pelo usuário com filtros opcionais.',
        querystring: listLibraryQuerySchema,
        response: {
          200: listLibraryResponseSchema,
        },
      },
    },
    listLibrary,
  )

  app.post(
    '/api/library',
    {
      preHandler: [verifyJwt],
      schema: {
        tags: ['Library'],
        summary: 'Adicionar obra à biblioteca',
        description: 'Adiciona uma fonte inspecionada à biblioteca do usuário.',
        body: addToLibraryBodySchema,
        response: {
          200: userLibrarySchema,
        },
      },
    },
    addToLibrary,
  )

  app.delete(
    '/api/library/:sourceId',
    {
      preHandler: [verifyJwt],
      schema: {
        tags: ['Library'],
        summary: 'Remover obra da biblioteca',
        description: 'Remove uma obra salva na biblioteca do usuário.',
        params: libraryParamsSchema,
        response: {
          200: removeFromLibraryResponseSchema,
        },
      },
    },
    removeFromLibrary,
  )

  app.patch(
    '/api/library/:sourceId/favorite',
    {
      preHandler: [verifyJwt],
      schema: {
        tags: ['Library'],
        summary: 'Favoritar/Desfavoritar obra',
        description: 'Atualiza o status de favorito de uma obra na biblioteca.',
        params: libraryParamsSchema,
        body: toggleFavoriteBodySchema,
        response: {
          200: userLibrarySchema,
        },
      },
    },
    toggleFavorite,
  )
}
