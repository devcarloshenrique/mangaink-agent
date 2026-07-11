import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { inspectSource } from './controllers/inspect-source.controller'
import { getSource } from './controllers/preview-source.controller'
import { sourceEvents } from './controllers/source-events.controller'
import { listProviders } from './controllers/providers.controller'
import { inspectSourceBodySchema, inspectSourceQuerySchema } from './dtos/inspect-source.dto'
import { sourceParamsSchema } from './dtos/preview-source.dto'

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

export const scrapingRoutes: FastifyPluginAsyncZod = async (app) => {
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
          'motores (cheerio, api, playwright) e domínios suportados.',
        response: {
          200: z.object({
            providers: z.array(
              z.object({
                slug: z.string(),
                name: z.string(),
                engine: z.enum(['api', 'cheerio', 'playwright']),
                allowedDomains: z.array(z.string()),
              }),
            ),
          }),
        },
      },
    },
    listProviders,
  )
}
