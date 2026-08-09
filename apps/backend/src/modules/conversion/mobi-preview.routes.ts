import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { getConversionRepository, getConversionJobRepository } from '../../shared/database/repositories'
import { verifyJwt } from '../../shared/middlewares/verify-jwt'
import {
  StartMobiPreviewUseCase,
  GetMobiPreviewStatusUseCase,
  GetMobiPreviewPageUseCase,
  type MobiPreviewJobData,
} from './use-cases/mobi-preview.use-case'
import { MobiPreviewService } from './services/mobi-preview.service'
import { MobiPreviewStatusStore } from '../../shared/redis/mobi-preview-status-store'
import { MobiPreviewQueueService } from './services/mobi-preview-queue.service'
import type { IQueueService } from '../../shared/infra'
import { createRedisQueueAdapter, type RuntimeAdapters } from '../../shared/infra/factory'
import {
  startMobiPreviewHandler,
  getMobiPreviewStatusHandler,
  getMobiPreviewPageHandler,
} from './controllers/mobi-preview.controller'
import {
  mobiPreviewParamsSchema,
  mobiPreviewPageParamsSchema,
  mobiPreviewStartResponseSchema,
  mobiPreviewStatusResponseSchema,
} from './dtos/mobi-preview.dto'

// ── Instâncias compartilhadas ──────────────────────────────────────────
// Com o `runtime` presente, fila e status store são as MESMAS instâncias dos
// workers. Sem runtime, o default é o adapter Redis web — comportamento legado.
function buildMobiPreviewDeps(opts?: { runtime?: RuntimeAdapters }) {
  const runtime = opts?.runtime
  const service = new MobiPreviewService()
  const store = new MobiPreviewStatusStore(runtime ? runtime.status : undefined)
  const queue = new MobiPreviewQueueService(
    (runtime ? runtime.getQueue('mobi-preview') : createRedisQueueAdapter('mobi-preview')) as IQueueService<MobiPreviewJobData>,
  )

  const startMobiPreviewUseCase = new StartMobiPreviewUseCase(
    getConversionRepository(),
    getConversionJobRepository(),
    service,
    store,
    queue,
  )
  const getMobiPreviewStatusUseCase = new GetMobiPreviewStatusUseCase(
    getConversionRepository(),
    getConversionJobRepository(),
    service,
    store,
  )
  const getMobiPreviewPageUseCase = new GetMobiPreviewPageUseCase(
    getConversionRepository(),
    getConversionJobRepository(),
    service,
  )

  return { startMobiPreviewUseCase, getMobiPreviewStatusUseCase, getMobiPreviewPageUseCase }
}

interface MobiPreviewRoutesOptions {
  runtime?: RuntimeAdapters
}

const notFound = z.object({ error: z.string() })
const forbidden = z.object({ error: z.string() })
const badRequest = z.object({ error: z.string() })
const previewNotReady = z.object({
  error: z.string(),
  readyPages: z.number().int().nonnegative().optional(),
  totalPages: z.number().int().nonnegative().optional(),
})

export const mobiPreviewRoutes: FastifyPluginAsyncZod<MobiPreviewRoutesOptions> = async (app, opts) => {
  const { startMobiPreviewUseCase, getMobiPreviewStatusUseCase, getMobiPreviewPageUseCase } =
    buildMobiPreviewDeps(opts)

  // POST /api/conversions/:conversionId/jobs/:jobId/preview
  app.post(
    '/api/conversions/:conversionId/jobs/:jobId/preview',
    {
      preHandler: verifyJwt,
      schema: {
        tags: ['Conversion'],
        summary: 'Inicia extracao de preview MOBI para leitura no navegador',
        description:
          'Idempotente: enfileira um job BullMQ que extrai as paginas do MOBI ' +
          'preservando a ordem do spine original. Retorna 200 se cache /temp/ ' +
          '(TTL 24h) e valido, 202 se a extracao foi enfileirada.',
        security: [{ bearerAuth: [] }],
        params: mobiPreviewParamsSchema,
        response: {
          200: mobiPreviewStartResponseSchema,
          202: mobiPreviewStartResponseSchema,
          403: forbidden,
          404: notFound,
          400: badRequest,
        },
      },
    },
    startMobiPreviewHandler(startMobiPreviewUseCase),
  )

  // GET /api/conversions/:conversionId/jobs/:jobId/preview
  app.get(
    '/api/conversions/:conversionId/jobs/:jobId/preview',
    {
      preHandler: verifyJwt,
      schema: {
        tags: ['Conversion'],
        summary: 'Status da extracao de preview MOBI',
        description:
          'Agrega estado live do Redis Hash (status, readyPages, totalPages) ' +
          'com leitura do FS (index.json, cacheUntil). Recomendado para poll ' +
          'a cada 1s enquanto extracao processa.',
        security: [{ bearerAuth: [] }],
        params: mobiPreviewParamsSchema,
        response: {
          200: mobiPreviewStatusResponseSchema,
          403: forbidden,
          404: notFound,
          400: badRequest,
        },
      },
    },
    getMobiPreviewStatusHandler(getMobiPreviewStatusUseCase),
  )

  // GET /api/conversions/:conversionId/jobs/:jobId/preview/pages/:index
  app.get(
    '/api/conversions/:conversionId/jobs/:jobId/preview/pages/:index',
    {
      preHandler: verifyJwt,
      schema: {
        tags: ['Conversion'],
        summary: 'Serve uma pagina individual do preview MOBI',
        description:
          'Stream da imagem em /temp/<file-base>/images/NNNNN.<ext>. ' +
          'Cache-Control: public, max-age=86400, immutable. ' +
          'Retorna 425 se a pagina ainda nao foi escrita em disco.',
        security: [{ bearerAuth: [] }],
        params: mobiPreviewPageParamsSchema,
        response: {
          425: previewNotReady,
          403: forbidden,
          404: notFound,
          400: badRequest,
        },
      },
    },
    getMobiPreviewPageHandler(getMobiPreviewPageUseCase),
  )
}