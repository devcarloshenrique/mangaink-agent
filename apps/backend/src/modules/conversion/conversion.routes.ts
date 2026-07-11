import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { conversionOptionsHandler } from './controllers/conversion-options.controller'
import { createConversionHandler } from './controllers/create-conversion.controller'
import { getConversionHandler } from './controllers/get-conversion.controller'
import { conversionEventsHandler } from './controllers/conversion-events.controller'
import { cancelConversionHandler } from './controllers/cancel-conversion.controller'
import { CreateConversionUseCase } from './use-cases/create-conversion.use-case'
import { GetConversionUseCase } from './use-cases/get-conversion.use-case'
import { CancelConversionUseCase } from './use-cases/cancel-conversion.use-case'
import { FilesystemConversionRepository } from './repositories/filesystem-conversion.repository'
import { FilesystemJobRepository } from './repositories/filesystem-job.repository'
import { ConversionQueueService } from './services/conversion-queue.service'
import { ConversionPubSubService } from './services/conversion-pubsub.service'
import { ConversionEventsService } from './services/conversion-events.service'
import {
  createConversionBodySchema,
  createConversionResponseSchema,
} from './dtos/create-conversion.dto'
import { conversionParamsSchema } from './dtos/conversion-params.dto'
import { conversionOptionsResponseSchema } from './dtos/conversion-options.dto'
import { verifyJwt } from '../../shared/middlewares/verify-jwt'

// ── Instâncias compartilhadas ──────────────────────────────────────────
const conversions = new FilesystemConversionRepository()
const jobRepository = new FilesystemJobRepository()
const queue = new ConversionQueueService()
const pubsub = new ConversionPubSubService()
const events = new ConversionEventsService(pubsub)

const createConversionUseCase = new CreateConversionUseCase(conversions, jobRepository, queue, events)
const getConversionUseCase = new GetConversionUseCase(conversions)
const cancelConversionUseCase = new CancelConversionUseCase(conversions, queue, events)

const conversionStateSchema = z.object({
  conversionId: z.string(),
  status: z.enum(['queued', 'processing', 'completed', 'failed', 'cancelled', 'partial']),
  progress: z.number(),
  totalJobs: z.number(),
  completedJobs: z.number(),
  failedJobs: z.number(),
  runningJobs: z.number(),
  pendingJobs: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
  completedAt: z.string().optional(),
  finishedAt: z.string().optional(),
  error: z.string().optional(),
  jobs: z.array(
    z.object({
      jobId: z.string(),
      index: z.number(),
      title: z.string(),
      status: z.enum([
        'queued',
        'preparing',
        'downloading',
        'converting',
        'packaging',
        'completed',
        'failed',
        'cancelled',
      ]),
      progress: z.number(),
      outputFile: z.string().optional(),
      outputSize: z.number().optional(),
      downloadUrl: z.string().optional(),
      error: z.string().optional(),
    }),
  ),
  config: z.any(),
})

export const conversionRoutes: FastifyPluginAsyncZod = async (app) => {
  // GET /api/conversions/options
  app.get(
    '/api/conversions/options',
    {
      schema: {
        tags: ['Conversion'],
        summary: 'Catálogo de opções de conversão',
        description:
          'Retorna dispositivos, formatos, campos de configuração (sem batchSplit/fileFusion) ' +
          'e presets disponíveis. Endpoint público. As flags internas do KCC ' +
          '(batchSplit, fileFusion) são definidas automaticamente pelo Planner.',
        response: {
          200: conversionOptionsResponseSchema,
        },
      },
    },
    conversionOptionsHandler,
  )

  // POST /api/conversions
  app.post(
    '/api/conversions',
    {
      preHandler: verifyJwt,
      schema: {
        tags: ['Conversion'],
        summary: 'Cria uma nova Conversion (intenção do usuário)',
        description:
          'O corpo descreve quais livros o usuário deseja obter. O backend (Planner) valida, ' +
          'aplica herança de capa global, gera 1 Job por Book (definindo batchSplit/fileFusion ' +
          'automaticamente) e enfileira. Retorna o conversionId para acompanhamento.',
        security: [{ bearerAuth: [] }],
        body: createConversionBodySchema,
        response: {
          202: createConversionResponseSchema,
          400: z.object({ error: z.string() }),
          404: z.object({ error: z.string() }),
        },
      },
    },
    createConversionHandler(createConversionUseCase),
  )

  // GET /api/conversions/:conversionId
  app.get(
    '/api/conversions/:conversionId',
    {
      preHandler: verifyJwt,
      schema: {
        tags: ['Conversion'],
        summary: 'Estado agregado de uma Conversion',
        description:
          'Retorna o status agregado da Conversion (computado a partir dos status.json dos Jobs) ' +
          'e a lista de Jobs com progresso individual.',
        security: [{ bearerAuth: [] }],
        params: conversionParamsSchema,
        response: {
          200: conversionStateSchema,
          404: z.object({ error: z.string() }),
        },
      },
    },
    getConversionHandler(getConversionUseCase),
  )

  // GET /api/conversions/:conversionId/events (SSE fan-in)
  app.get(
    '/api/conversions/:conversionId/events',
    {
      preHandler: verifyJwt,
      schema: {
        tags: ['Conversion'],
        summary: 'Eventos SSE agregados de uma Conversion',
        description:
          'Stream Server-Sent Events que faz fan-in de todos os Jobs da Conversion. ' +
          'Cada evento carrega o campo `jobId` em data, permitindo ao frontend ' +
          'saber a qual Job pertence a atualização.',
        security: [{ bearerAuth: [] }],
        params: conversionParamsSchema,
      },
    },
    conversionEventsHandler(events, getConversionUseCase),
  )

  // DELETE /api/conversions/:conversionId
  app.delete(
    '/api/conversions/:conversionId',
    {
      preHandler: verifyJwt,
      schema: {
        tags: ['Conversion'],
        summary: 'Cancela uma Conversion',
        description:
          'Cancela todos os Jobs ainda pendentes ou em andamento da Conversion. ' +
          'Conversions em estado terminal (completed/failed/cancelled) não podem ser canceladas.',
        security: [{ bearerAuth: [] }],
        params: conversionParamsSchema,
        response: {
          200: z.object({
            conversionId: z.string(),
            status: z.literal('cancelled'),
          }),
          404: z.object({ error: z.string() }),
          409: z.object({ error: z.string() }),
        },
      },
    },
    cancelConversionHandler(cancelConversionUseCase),
  )

  // Alias: POST /api/conversions/:conversionId/cancel (compat de estilo REST)
  app.post(
    '/api/conversions/:conversionId/cancel',
    {
      preHandler: verifyJwt,
      schema: {
        tags: ['Conversion'],
        summary: 'Cancela uma Conversion (alias POST)',
        security: [{ bearerAuth: [] }],
        params: conversionParamsSchema,
        response: {
          200: z.object({
            conversionId: z.string(),
            status: z.literal('cancelled'),
          }),
          404: z.object({ error: z.string() }),
          409: z.object({ error: z.string() }),
        },
      },
    },
    cancelConversionHandler(cancelConversionUseCase),
  )
}