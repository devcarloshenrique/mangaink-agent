import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import type { RuntimeAdapters } from '../../shared/infra/factory'
import { createChapterDownload } from './controllers/create-chapter-download.controller'
import { getChapterDownload } from './controllers/get-chapter-download.controller'
import { createChapterDownloadEventsController } from './controllers/chapter-download-events.controller'
import { serveChapterImage } from './controllers/serve-chapter-image.controller'
import { createDeleteChapterCacheController } from './controllers/delete-chapter-cache.controller'
import {
  createBatchDeleteChapterCacheController,
  batchDeleteChapterCacheBodySchema,
} from './controllers/batch-delete-chapter-cache.controller'
import { verifyJwt } from '../../shared/middlewares/verify-jwt'

interface ChapterRoutesOptions {
  runtime?: RuntimeAdapters
}

const chapterParamsSchema = z.object({
  sourceId: z.string(),
  chapterId: z.string(),
})

const chapterImageParamsSchema = z.object({
  sourceId: z.string(),
  chapterId: z.string(),
  index: z.string(),
})

const downloadResponseSchema = z.object({
  jobId: z.string(),
  status: z.enum(['queued', 'downloading', 'ready', 'failed']),
})

const downloadStatusResponseSchema = z.object({
  status: z.enum(['queued', 'downloading', 'ready', 'failed', 'not_downloaded']),
  totalImages: z.number().nullable(),
  downloadedImages: z.number(),
  jobId: z.string().nullable(),
  error: z.string().nullable().optional(),
})

export const chapterRoutes: FastifyPluginAsyncZod<ChapterRoutesOptions> = async (app, opts) => {
  const chapterDownloadEvents = createChapterDownloadEventsController(opts.runtime)

  // POST /api/sources/:sourceId/chapters/:chapterId/download
  app.post(
    '/api/sources/:sourceId/chapters/:chapterId/download',
    {
      onRequest: [verifyJwt],
      schema: {
        tags: ['Chapters'],
        summary: 'Baixa as imagens de um capítulo',
        description:
          'Enfileira job BullMQ para download assíncrono das imagens do capítulo. ' +
          'Aceita body JSON opcional { batchId } para agrupar o capítulo num lote do ' +
          'usuário (notificação agregada ao fim, em vez de uma por capítulo). ' +
          'Sem body schema declarado para aceitar chamadas sem payload.',
        params: chapterParamsSchema,
        response: {
          200: downloadResponseSchema,
          202: downloadResponseSchema,
          404: z.object({ error: z.string() }),
        },
      },
    },
    createChapterDownload,
  )

  // GET /api/sources/:sourceId/chapters/:chapterId/download
  app.get(
    '/api/sources/:sourceId/chapters/:chapterId/download',
    {
      onRequest: [verifyJwt],
      schema: {
        tags: ['Chapters'],
        summary: 'Status do download do capítulo',
        description: 'Retorna o status atual do download (cache, job ativo, etc.).',
        params: chapterParamsSchema,
        response: {
          200: downloadStatusResponseSchema,
          404: z.object({ error: z.string() }),
        },
      },
    },
    getChapterDownload,
  )

  // GET /api/sources/:sourceId/chapters/:chapterId/download/events (SSE)
  app.get(
    '/api/sources/:sourceId/chapters/:chapterId/download/events',
    {
      onRequest: [verifyJwt],
      schema: {
        tags: ['Chapters'],
        summary: 'Eventos SSE do download do capítulo',
        description:
          'Stream Server-Sent Events com progresso em tempo real do download. ' +
          'Eventos: progress (downloaded, total), completed, failed.',
        params: chapterParamsSchema,
      },
    },
    chapterDownloadEvents,
  )

  // GET /api/sources/:sourceId/chapters/:chapterId/images/:index (público)
  app.get(
    '/api/sources/:sourceId/chapters/:chapterId/images/:index',
    {
      schema: {
        tags: ['Chapters'],
        summary: 'Serve uma página do capítulo',
        description:
          'Serve a imagem da página solicitada. Cache-first: se disponível em disco, serve do cache. ' +
          'Se não, faz proxy inteligente via provider. Público — tags <img> não conseguem enviar Bearer token.',
        params: chapterImageParamsSchema,
        response: {
          400: z.object({ error: z.string() }),
          404: z.object({ error: z.string() }),
        },
      },
    },
    serveChapterImage,
  )

  const deleteChapterCacheHandler = createDeleteChapterCacheController(opts.runtime)
  const batchDeleteChapterCacheHandler = createBatchDeleteChapterCacheController(opts.runtime)

  app.delete(
    '/api/sources/:sourceId/chapters/:chapterId/cache',
    {
      onRequest: [verifyJwt],
      schema: {
        tags: ['Chapters'],
        summary: 'Remove cache de imagens do capítulo',
        description:
          'Remove do disco todas as imagens cacheadas do capítulo. Retorna o status da operação.',
        params: chapterParamsSchema,
        response: {
          200: z.object({
            deleted: z.boolean(),
            reason: z.string().optional(),
          }),
          404: z.object({ error: z.string() }),
        },
      },
    },
    deleteChapterCacheHandler,
  )

  app.post(
    '/api/sources/:sourceId/chapters/batch-delete-cache',
    {
      onRequest: [verifyJwt],
      schema: {
        tags: ['Chapters'],
        summary: 'Remove cache de imagens de múltiplos capítulos em lote',
        description:
          'Remove do disco as imagens cacheadas dos capítulos informados e notifica via central de notificações.',
        params: z.object({ sourceId: z.string() }),
        body: batchDeleteChapterCacheBodySchema,
        response: {
          200: z.object({
            deletedCount: z.number(),
            totalCount: z.number(),
            alreadyCleanCount: z.number().optional(),
            failedCount: z.number(),
          }),
          404: z.object({ error: z.string() }),
        },
      },
    },
    batchDeleteChapterCacheHandler,
  )
}
