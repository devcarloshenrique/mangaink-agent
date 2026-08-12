import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import type { RuntimeAdapters } from '../../shared/infra/factory'
import { createInspectSourceController } from './controllers/inspect-source.controller'
import { getSource } from './controllers/preview-source.controller'
import { createSourceEventsController } from './controllers/source-events.controller'
import { listProviders, updateProvider } from './controllers/providers.controller'
import { inspectSourceBodySchema, inspectSourceQuerySchema } from './dtos/inspect-source.dto'
import { sourceParamsSchema } from './dtos/preview-source.dto'
import {
  listProvidersResponseSchema,
  providerParamsSchema,
  providerResponseSchema,
  updateProviderBodySchema,
} from './dtos/provider.dto'
import { verifyJwtOptional } from '../../shared/middlewares/verify-jwt-optional'
import { verifyJwt } from '../../shared/middlewares/verify-jwt'

interface ScrapingRoutesOptions {
  runtime?: RuntimeAdapters
}

const sourceStateSchema = z.object({
  sourceId: z.string(),
  status: z.enum(['processing', 'ready', 'failed']),
})

const chapterSchema = z.object({
  id: z.string(),
  number: z.string(),
  title: z.string(),
  url: z.string(),
  pages: z.number().nullable(),
  volume: z.number().nullable(),
  isDownloaded: z.boolean(),
  isRead: z.boolean(),
})

const coverSchema = z.object({
  id: z.string(),
  type: z.enum(['original', 'gallery', 'upload']),
  label: z.string(),
  imageUrl: z.string(),
})

const sourceResponseSchema = z.object({
  sourceId: z.string(),
  status: z.literal('ready'),
  provider: z.object({
    slug: z.string(),
    name: z.string(),
    engine: z.enum(['api', 'cheerio', 'playwright']),
  }),
  source: z.object({
    url: z.string(),
    language: z.string().nullable(),
  }),
  metadata: z.object({
    title: z.string(),
    author: z.string().nullable(),
    description: z.string().nullable(),
    status: z.string().nullable(),
    genres: z.array(z.string()),
  }),
  chapters: z.array(chapterSchema),
  covers: z.array(coverSchema),
  statistics: z.object({
    chapters: z.number(),
    covers: z.number(),
  }),
})

export const scrapingRoutes: FastifyPluginAsyncZod<ScrapingRoutesOptions> = async (app, opts) => {
  const inspectSource = createInspectSourceController(opts.runtime)
  const sourceEvents = createSourceEventsController(opts.runtime)

  // POST /api/conversions/source/inspect
  app.post(
    '/api/conversions/source/inspect',
    {
      schema: {
        tags: ['Scraping'],
        summary: 'Inspeciona uma obra',
        description:
          'Dispara inspeção assíncrona (scraping) de uma URL de mangá. ' +
          'Retorna 200 se o cache ainda é válido, ou 202 se um novo job de scraping foi enfileirado. ' +
          'Acompanhe o progresso via GET /source/inspect/:sourceId/events (SSE).',
        body: inspectSourceBodySchema,
        querystring: inspectSourceQuerySchema,
        response: {
          200: sourceStateSchema,
          202: sourceStateSchema,
          400: z.object({ error: z.string() }),
          422: z.object({ error: z.string() }),
        },
      },
    },
    inspectSource,
  )

  // GET /api/conversions/source/inspect/:sourceId/events (SSE — sem schema Zod no response)
  app.get(
    '/api/conversions/source/inspect/:sourceId/events',
    {
      schema: {
        tags: ['Scraping'],
        summary: 'Eventos SSE de progresso do scraping',
        description:
          'Stream Server-Sent Events com atualizações em tempo real do scraping. ' +
          'Eventos: progress (stage, message, progress%), completed, failed.',
        params: sourceParamsSchema,
      },
    },
    sourceEvents,
  )

  // GET /api/conversions/source/inspect/:sourceId
  app.get(
    '/api/conversions/source/inspect/:sourceId',
    {
      preHandler: [verifyJwtOptional],
      schema: {
        tags: ['Scraping'],
        summary: 'Metadados de uma source inspecionada',
        description:
          'Retorna metadados completos da obra: título, autor, sinopse, gêneros, ' +
          'lista de capítulos, capas disponíveis e estatísticas.',
        params: sourceParamsSchema,
        response: {
          200: sourceResponseSchema,
          404: z.object({ error: z.string() }),
        },
      },
    },
    getSource,
  )

  // GET /api/conversions/source/providers
  app.get(
    '/api/conversions/source/providers',
    {
      schema: {
        tags: ['Scraping'],
        summary: 'Lista providers disponíveis',
        description:
          'Retorna todos os providers de scraping disponíveis, seus slugs, ' +
          'motores (cheerio, api, playwright), status, URLs e rate limits. ' +
          '`allowedDomains` não é exposto (SSRF protection é interna).',
        response: {
          200: listProvidersResponseSchema,
        },
      },
    },
    listProviders,
  )

  // PATCH /api/conversions/source/providers/:slug
  app.patch(
    '/api/conversions/source/providers/:slug',
    {
      onRequest: [verifyJwt],
      schema: {
        tags: ['Scraping'],
        summary: 'Atualiza um provider',
        description:
          'Atualiza campos parciais de um provider (status, metadados, tags e ' +
          'rate limit). Persiste no banco e propaga a nova config de rate limit ' +
          'para o resolver de providers.',
        security: [{ bearerAuth: [] }],
        params: providerParamsSchema,
        body: updateProviderBodySchema,
        response: {
          200: providerResponseSchema,
          400: z.object({ error: z.string() }),
          401: z.object({ error: z.string() }),
          404: z.object({ error: z.string() }),
        },
      },
    },
    updateProvider,
  )
}
