import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { verifyJwt } from '../../shared/middlewares/verify-jwt'
import {
  readingParamsSchema,
  readingChapterParamsSchema,
  batchMarkReadBodySchema,
  markReadResponseSchema,
  unmarkReadResponseSchema,
  readingProgressResponseSchema,
  batchMarkReadResponseSchema,
} from './dtos/reading.dto'
import { markRead } from './controllers/mark-read.controller'
import { unmarkRead } from './controllers/unmark-read.controller'
import { getProgress } from './controllers/get-progress.controller'
import { batchMarkRead } from './controllers/batch-mark-read.controller'

export const readingRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post(
    '/api/reading/:sourceId/chapters/:chapterId',
    {
      preHandler: [verifyJwt],
      schema: {
        tags: ['Reading'],
        summary: 'Marcar capítulo como lido',
        description: 'Marca um capítulo como lido para o usuário autenticado.',
        params: readingChapterParamsSchema,
        response: {
          200: markReadResponseSchema,
        },
      },
    },
    markRead,
  )

  app.delete(
    '/api/reading/:sourceId/chapters/:chapterId',
    {
      preHandler: [verifyJwt],
      schema: {
        tags: ['Reading'],
        summary: 'Desmarcar capítulo como lido',
        description: 'Remove a marca de leitura de um capítulo.',
        params: readingChapterParamsSchema,
        response: {
          200: unmarkReadResponseSchema,
        },
      },
    },
    unmarkRead,
  )

  app.get(
    '/api/reading/:sourceId',
    {
      preHandler: [verifyJwt],
      schema: {
        tags: ['Reading'],
        summary: 'Listar progresso de leitura',
        description: 'Retorna o progresso de leitura de todos os capítulos de uma fonte.',
        params: readingParamsSchema,
        response: {
          200: readingProgressResponseSchema,
        },
      },
    },
    getProgress,
  )

  app.put(
    '/api/reading/:sourceId/batch',
    {
      preHandler: [verifyJwt],
      schema: {
        tags: ['Reading'],
        summary: 'Marcar/desmarcar capítulos em lote',
        description: 'Marca ou desmarca múltiplos capítulos como lidos em uma única operação.',
        params: readingParamsSchema,
        body: batchMarkReadBodySchema,
        response: {
          200: batchMarkReadResponseSchema,
        },
      },
    },
    batchMarkRead,
  )
}
