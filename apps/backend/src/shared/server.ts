import Fastify, { type FastifyError } from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import cookie from '@fastify/cookie'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod'
import { env } from './config/env'
import { healthRoutes } from '../modules/health/health.routes'
import { authRoutes } from '../modules/auth/auth.routes'
import { scrapingRoutes } from '../modules/scraping/scraping.routes'
import { conversionRoutes } from '../modules/conversion/conversion.routes'
import { mobiPreviewRoutes } from '../modules/conversion/mobi-preview.routes'
import { chapterRoutes } from '../modules/scraping/chapter.routes'
import { readingRoutes } from '../modules/reading/reading.routes'
import { ConversionError } from '../modules/conversion/errors/conversion.errors'
import { UserAlreadyExistsError, InvalidCredentialsError, EmailAlreadyInUseError, UsernameAlreadyInUseError } from '../modules/auth/errors/auth.errors'
import { ChapterNotFoundError, PageNotFoundError, InvalidPageIndexError, ChapterDownloadFailedError, PageNotReadyError } from '../modules/scraping/errors/chapter-download.errors'
import { SourceNotFoundError, ProviderNotFoundError } from '../modules/scraping/errors/scraping.errors'
import { startInspectSourceWorker } from '../modules/scraping/workers/inspect-source.worker'
import { startConversionJobWorker } from '../modules/conversion/workers/conversion-job.worker'
import { startDownloadOnlyWorker } from '../modules/conversion/workers/download-only.worker'
import { startMobiPreviewWorker } from '../modules/conversion/workers/mobi-preview.worker'
import { startChapterDownloadWorker } from '../modules/scraping/workers/chapter-download.worker'
import { createRuntimeAdapters } from './infra/factory'
import type { QueueWorkerHandle } from './infra/queue-worker'
import type { IQueueService } from './infra'
import type { ChapterDownloadData } from '../modules/scraping/types/chapter-download.types'
import { setChapterDownloadQueue } from '../modules/scraping/services/chapter-download-queue.service'
import { setChapterDownloadStatusStore } from '../modules/scraping/services/chapter-download-status-store'

export async function createServer() {
  const app = Fastify({
    logger: env.NODE_ENV === 'dev',
  }).withTypeProvider<ZodTypeProvider>()

  // Runtime de infraestrutura (embedded in-memory ou web/Redis) — usado para
  // iniciar os workers sem conexões no load do módulo.
  const runtime = createRuntimeAdapters()

  // ── CORS ────────────────────────────────────────────────────────────────────
  await app.register(cors, {
    origin: ['http://localhost:5173', 'http://localhost:4173'],
    credentials: true,
  })

  // ── Cookies ─────────────────────────────────────────────────────────────────
  await app.register(cookie, {
    secret: env.JWT_SECRET,
  })

  // ── JWT ─────────────────────────────────────────────────────────────────────
  await app.register(jwt, {
    secret: env.JWT_SECRET,
  })

  // ── Swagger / OpenAPI ────────────────────────────────────────────────────────
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'MangaInk Agent API',
        version: '1.0.0',
        description: 'API do sistema MangaInk Agent — autenticação, scraping e conversão de obras.',
        contact: { name: 'MangaInk Agent' },
      },
      servers: [
        {
          url: `http://localhost:${env.PORT}`,
          description: 'Servidor local de desenvolvimento',
        },
      ],
      tags: [
        { name: 'Health', description: 'Verificação do estado da API' },
        { name: 'Auth', description: 'Endpoints de autenticação' },
        { name: 'Scraping', description: 'Inspeção de fontes e scraping de obras' },
        { name: 'Chapters', description: 'Download e cache de imagens de capítulos' },
        { name: 'Conversion', description: 'Conversão de obras para formatos e-reader' },
        { name: 'Reading', description: 'Tracking de progresso de leitura' },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
    },
    transform: jsonSchemaTransform,
  })

  await app.register(swaggerUi, {
    routePrefix: '/api-docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
    },
    staticCSP: true,
  })

  // ── Zod validators ──────────────────────────────────────────────────────────
  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)

  // ── Error handler ───────────────────────────────────────────────────────────
  app.setNotFoundHandler((_request, reply) => {
    reply.code(404).send({ error: 'Not Found' })
  })

  app.setErrorHandler((error: FastifyError, _request, reply) => {
    if (error.validation) {
      return reply.code(400).send({
        error: error.message,
        issues: error.validation,
      })
    }

    if (error instanceof ConversionError) {
      const statusMap: Record<string, number> = {
        CONVERSION_NOT_FOUND: 404,
        SOURCE_NOT_FOUND: 404,
        CHAPTER_NOT_FOUND: 404,
        JOB_NOT_FOUND: 404,
        FORBIDDEN: 403,
        VALIDATION_ERROR: 400,
        DUPLICATE_CHAPTER: 404,
        INVALID_CONVERSION_STATE: 409,
        INVALID_JOB_STATE: 409,
        KCC_EXECUTION_ERROR: 500,
        DOWNLOAD_FAILED: 500,
        PREVIEW_NOT_READY: 425,
        LISTING_REQUIRES_PRISMA: 501,
        PRESET_NOT_FOUND: 404,
        DUPLICATE_PRESET_NAME: 409,
        PRESET_LIMIT_REACHED: 400,
      }
      const status = statusMap[error.code] ?? 500
      if (error.code === 'LISTING_REQUIRES_PRISMA') {
        return reply.code(status).send({
          error: { code: error.code, message: error.message },
        })
      }
      if (error.code === 'PREVIEW_NOT_READY') {
        const e = error as { readyCount?: number; totalCount?: number }
        return reply.code(status).send({
          error: error.message,
          readyPages: e.readyCount ?? 0,
          totalPages: e.totalCount ?? 0,
        })
      }
      return reply.code(status).send({ error: error.message })
    }

    if (error instanceof PageNotReadyError) return reply.code(425).send({
      error: error.message,
      readyPages: error.readyCount,
      totalPages: error.totalCount,
    })
    if (error instanceof SourceNotFoundError) return reply.code(404).send({ error: error.message })
    if (error instanceof ProviderNotFoundError) return reply.code(404).send({ error: error.message })
    if (error instanceof ChapterNotFoundError) return reply.code(404).send({ error: error.message })
    if (error instanceof PageNotFoundError) return reply.code(404).send({ error: error.message })
    if (error instanceof InvalidPageIndexError) return reply.code(400).send({ error: error.message })
    if (error instanceof ChapterDownloadFailedError) return reply.code(500).send({ error: error.message })

    if (error instanceof UserAlreadyExistsError) return reply.code(409).send({ error: error.message })
    if (error instanceof InvalidCredentialsError) return reply.code(401).send({ error: error.message })
    if (error instanceof EmailAlreadyInUseError) return reply.code(409).send({ error: error.message })
    if (error instanceof UsernameAlreadyInUseError) return reply.code(409).send({ error: error.message })

    app.log.error(error)
    reply.code(500).send({ error: 'Internal Server Error' })
  })

  // ── Rotas ───────────────────────────────────────────────────────────────────
  // Os produtores de download de capítulos (use-case/controller) consomem a
  // MESMA fila e status store do worker via runtime. Sem esses setters, o
  // default é o adapter Redis web — comportamento legado preservado.
  setChapterDownloadQueue(runtime.getQueue('chapter-download') as IQueueService<ChapterDownloadData>)
  setChapterDownloadStatusStore(runtime.status)

  await app.register(healthRoutes)
  await app.register(authRoutes)
  await app.register(scrapingRoutes, { runtime })
  await app.register(conversionRoutes, { runtime })
  await app.register(mobiPreviewRoutes, { runtime })
  await app.register(chapterRoutes, { runtime })
  await app.register(readingRoutes)

  // Inicia os workers de background (scraping, conversão, download-only,
  // preview MOBI e download de capítulos). Em modo embedded, todos rodam sobre
  // as filas in-memory do runtime; em modo web, sobre BullMQ/Redis. Os handles
  // são fechados no shutdown via hook onClose.
  if (env.NODE_ENV !== 'test') {
    const workerHandles: QueueWorkerHandle[] = [
      startInspectSourceWorker({ runtime }),
      startConversionJobWorker({ runtime }),
      startDownloadOnlyWorker({ runtime }),
      startMobiPreviewWorker({ runtime }),
      startChapterDownloadWorker({ runtime }),
    ]

    app.addHook('onClose', async () => {
      await Promise.allSettled(workerHandles.map((handle) => handle.close()))
    })
  }

  return app
}
