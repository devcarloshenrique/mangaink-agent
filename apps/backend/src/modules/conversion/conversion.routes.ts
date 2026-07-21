import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { conversionOptionsHandler } from './controllers/conversion-options.controller'
import { createConversionHandler } from './controllers/create-conversion.controller'
import { getConversionHandler } from './controllers/get-conversion.controller'
import { conversionEventsHandler } from './controllers/conversion-events.controller'
import { cancelConversionHandler } from './controllers/cancel-conversion.controller'
import { deleteConversionHandler } from './controllers/delete-conversion.controller'
import { listConversionsHandler } from './controllers/list-conversions.controller'
import { CreateConversionUseCase } from './use-cases/create-conversion.use-case'
import { GetConversionUseCase } from './use-cases/get-conversion.use-case'
import { CancelConversionUseCase } from './use-cases/cancel-conversion.use-case'
import { ListConversionsUseCase } from './use-cases/list-conversions.use-case'
import { ConversionQueueService } from './services/conversion-queue.service'
import { ConversionPubSubService } from './services/conversion-pubsub.service'
import { ConversionEventsService } from './services/conversion-events.service'
import { getConversionRepository, getConversionJobRepository, getSourceRepository } from '../../shared/database/repositories'
import { conversionLogsHandler } from './controllers/conversion-logs.controller'
import { GetConversionLogsUseCase } from './use-cases/get-conversion-logs.use-case'
import { downloadJobHandler } from './controllers/download-job.controller'
import { DownloadJobUseCase } from './use-cases/download-job.use-case'
import { DeleteConversionUseCase } from './use-cases/delete-conversion.use-case'
import { downloadJobParamsSchema } from './dtos/download-job.dto'
import { serveCoverHandler } from './controllers/serve-cover.controller'
import { ServeCoverUseCase } from './use-cases/serve-cover.use-case'
import { coverParamsSchema } from './dtos/cover-params.dto'
import {
  createConversionBodySchema,
  createConversionResponseSchema,
} from './dtos/create-conversion.dto'
import { conversionParamsSchema } from './dtos/conversion-params.dto'
import { conversionOptionsResponseSchema } from './dtos/conversion-options.dto'
import { listConversionsQuerySchema } from './dtos/list-conversions.dto'
import { verifyJwt } from '../../shared/middlewares/verify-jwt'
import {
  listUserPresetsHandler,
  createUserPresetHandler,
  updateUserPresetMetaHandler,
  updateUserPresetValuesHandler,
  deleteUserPresetHandler,
} from './controllers/user-presets.controller'
import {
  createUserPresetSchema,
  updateUserPresetSchema,
  updateUserPresetValuesSchema,
  presetParamsSchema,
  userPresetResponseSchema,
  userPresetListResponseSchema,
} from './dtos/user-preset.dto'

// ── Instâncias compartilhadas ──────────────────────────────────────────
const conversions = getConversionRepository()
const jobRepository = getConversionJobRepository()
const queue = new ConversionQueueService()
const pubsub = new ConversionPubSubService()
const events = new ConversionEventsService(pubsub)

const createConversionUseCase = new CreateConversionUseCase(conversions, jobRepository, queue, events)
const getConversionUseCase = new GetConversionUseCase(conversions)
const cancelConversionUseCase = new CancelConversionUseCase(conversions, queue, events)
const listConversionsUseCase = new ListConversionsUseCase(conversions)
const getConversionLogsUseCase = new GetConversionLogsUseCase(getConversionUseCase, pubsub)
const downloadJobUseCase = new DownloadJobUseCase(conversions, jobRepository)
const serveCoverUseCase = new ServeCoverUseCase(getSourceRepository())
const deleteConversionUseCase = new DeleteConversionUseCase(conversions)

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

const conversionSummarySchema = z.object({
  conversionId: z.string(),
  sourceId: z.string(),
  title: z.string(),
  status: z.enum(['queued', 'processing', 'completed', 'failed', 'cancelled', 'partial']),
  progress: z.number(),
  totalJobs: z.number(),
  completedJobs: z.number(),
  failedJobs: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
  finishedAt: z.string().optional(),
  cover: z.object({ kind: z.string() }).passthrough().optional(),
})

const listConversionsResponseSchema = z.object({
  items: z.array(conversionSummarySchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
})

const sseEventSchema = z.object({
  type: z.string(),
  data: z.record(z.unknown()),
  timestamp: z.string(),
  id: z.number().optional(),
})

const conversionLogsResponseSchema = z.array(sseEventSchema)

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

  // ── User Presets ────────────────────────────────────────────────────

  // GET /api/conversions/presets
  app.get(
    '/api/conversions/presets',
    {
      preHandler: verifyJwt,
      schema: {
        tags: ['Conversion'],
        summary: 'Lista presets do usuario autenticado',
        description:
          'Retorna todos os presets de conversao do usuario autenticado com o limite maximo configurado.',
        security: [{ bearerAuth: [] }],
        response: {
          200: userPresetListResponseSchema,
          401: z.object({ error: z.string() }),
        },
      },
    },
    listUserPresetsHandler,
  )

  // POST /api/conversions/presets
  app.post(
    '/api/conversions/presets',
    {
      preHandler: verifyJwt,
      schema: {
        tags: ['Conversion'],
        summary: 'Cria um novo preset de conversao',
        description:
          'Salva a configuracao atual como um preset reutilizavel. Nome unico por usuario.',
        security: [{ bearerAuth: [] }],
        body: createUserPresetSchema,
        response: {
          201: userPresetResponseSchema,
          400: z.object({ error: z.string() }),
          401: z.object({ error: z.string() }),
          409: z.object({ error: z.string() }),
        },
      },
    },
    createUserPresetHandler,
  )

  // PATCH /api/conversions/presets/:presetId
  app.patch(
    '/api/conversions/presets/:presetId',
    {
      preHandler: verifyJwt,
      schema: {
        tags: ['Conversion'],
        summary: 'Edita metadados de um preset',
        description: 'Atualiza nome, descricao e/ou flag isDefault de um preset do usuario.',
        security: [{ bearerAuth: [] }],
        params: presetParamsSchema,
        body: updateUserPresetSchema,
        response: {
          200: userPresetResponseSchema,
          400: z.object({ error: z.string() }),
          404: z.object({ error: z.string() }),
        },
      },
    },
    updateUserPresetMetaHandler,
  )

  // PUT /api/conversions/presets/:presetId/values
  app.put(
    '/api/conversions/presets/:presetId/values',
    {
      preHandler: verifyJwt,
      schema: {
        tags: ['Conversion'],
        summary: 'Atualiza valores de um preset',
        description: 'Substitui os valores (fieldOptions) de um preset existente.',
        security: [{ bearerAuth: [] }],
        params: presetParamsSchema,
        body: updateUserPresetValuesSchema,
        response: {
          200: userPresetResponseSchema,
          400: z.object({ error: z.string() }),
          404: z.object({ error: z.string() }),
        },
      },
    },
    updateUserPresetValuesHandler,
  )

  // DELETE /api/conversions/presets/:presetId
  app.delete(
    '/api/conversions/presets/:presetId',
    {
      preHandler: verifyJwt,
      schema: {
        tags: ['Conversion'],
        summary: 'Exclui um preset',
        description: 'Remove permanentemente um preset do usuario.',
        security: [{ bearerAuth: [] }],
        params: presetParamsSchema,
        response: {
          204: z.object({}).nullable(),
          404: z.object({ error: z.string() }),
        },
      },
    },
    deleteUserPresetHandler,
  )

  // GET /api/conversions (listagem paginada por usuário)
  app.get(
    '/api/conversions',
    {
      preHandler: verifyJwt,
      schema: {
        tags: ['Conversion'],
        summary: 'Lista conversões do usuário autenticado',
        description:
          'Retorna conversões paginadas pertencentes ao usuário autenticado, ordenadas por ' +
          'criação descendente, com filtros opcionais por status e sourceId. ' +
          'Cada item é um resumo leve (sem books/options/chapters) — use ' +
          'GET /api/conversions/:id para detalhe. ' +
          'Requer backend Prisma (REPO_BACKEND=prisma); em modo filesystem retorna 501.',
        security: [{ bearerAuth: [] }],
        querystring: listConversionsQuerySchema,
        response: {
          200: listConversionsResponseSchema,
          401: z.object({ error: z.string() }),
          501: z.object({ error: z.object({ code: z.string(), message: z.string() }) }),
        },
      },
    },
    listConversionsHandler(listConversionsUseCase),
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
          403: z.object({ error: z.string() }),
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
        summary: 'Remove permanentemente uma Conversion',
        description:
          'Remove a Conversion do banco de dados. Para cancelar sem remover, use POST /.../cancel.',
        security: [{ bearerAuth: [] }],
        params: conversionParamsSchema,
        response: {
          200: z.object({
            conversionId: z.string(),
            status: z.literal('deleted'),
          }),
          404: z.object({ error: z.string() }),
          403: z.object({ error: z.string() }),
        },
      },
    },
    deleteConversionHandler(deleteConversionUseCase),
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
          403: z.object({ error: z.string() }),
        },
      },
    },
    cancelConversionHandler(cancelConversionUseCase),
  )

  // GET /api/conversions/:conversionId/jobs/:jobId/download
  app.get(
    '/api/conversions/:conversionId/jobs/:jobId/download',
    {
      preHandler: verifyJwt,
      schema: {
        tags: ['Conversion'],
        summary: 'Download do arquivo de saida de um Job',
        description: 'Retorna o arquivo EPUB/MOBI/CBZ/PDF gerado pelo KCC para o Job especificado.',
        security: [{ bearerAuth: [] }],
        params: downloadJobParamsSchema,
        response: {
          404: z.object({ error: z.string() }),
          403: z.object({ error: z.string() }),
        },
      },
    },
    downloadJobHandler(downloadJobUseCase),
  )

  // GET /api/conversions/source/:sourceId/covers/:coverId — publico
  app.get(
    '/api/conversions/source/:sourceId/covers/:coverId',
    {
      schema: {
        tags: ['Conversion'],
        summary: 'Imagem de capa cacheada de uma Source',
        description: 'Retorna a imagem de capa do cache local. Se nao existir, baixa do provider e cacheia.',
        params: coverParamsSchema,
        response: {
          404: z.object({ error: z.string() }),
        },
      },
    },
    serveCoverHandler(serveCoverUseCase),
  )

  // GET /api/conversions/:conversionId/logs'
  app.get(
    '/api/conversions/:conversionId/logs',
    {
      preHandler: verifyJwt,
      schema: {
        tags: ['Conversion'],
        summary: 'Logs de eventos de uma Conversion',
        description:
          'Retorna todos os eventos do journal (SSE) persistidos no Redis para cada Job da Conversion. ' +
          'Permite ao frontend recuperar o histórico de logs após recarregar a página.',
        security: [{ bearerAuth: [] }],
        params: conversionParamsSchema,
        response: {
          200: conversionLogsResponseSchema,
          404: z.object({ error: z.string() }),
          403: z.object({ error: z.string() }),
        },
      },
    },
    conversionLogsHandler(getConversionLogsUseCase),
  )
}