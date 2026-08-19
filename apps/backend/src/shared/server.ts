import Fastify, { type FastifyError } from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import cookie from '@fastify/cookie'
import helmet from '@fastify/helmet'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod'
import { env } from './config/env'
import { logger } from './logging/logger'
import { securityHeadersConfig } from './utils/security-headers'
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
import { SourceNotFoundError, ProviderNotFoundError, ProviderBySlugNotFoundError } from '../modules/scraping/errors/scraping.errors'
import { startInspectSourceWorker } from '../modules/scraping/workers/inspect-source.worker'
import { startConversionJobWorker } from '../modules/conversion/workers/conversion-job.worker'
import { startDownloadOnlyWorker } from '../modules/conversion/workers/download-only.worker'
import { startMobiPreviewWorker } from '../modules/conversion/workers/mobi-preview.worker'
import { startChapterDownloadWorker } from '../modules/scraping/workers/chapter-download.worker'
import { startConversionStorageSweeper } from '../modules/conversion/services/conversion-storage-sweeper.service'
import { createRuntimeAdapters } from './infra/factory'
import type { QueueWorkerHandle } from './infra/queue-worker'
import type { IQueueService } from './infra'
import type { ChapterDownloadData } from '../modules/scraping/types/chapter-download.types'
import { setChapterDownloadQueue } from '../modules/scraping/services/chapter-download-queue.service'
import { setChapterDownloadStatusStore } from '../modules/scraping/services/chapter-download-status-store'
import { setInspectOwnerStatusStore } from '../modules/scraping/services/inspect-owner-status-store'
import { createTokenDenylist, setTokenDenylist } from '../modules/auth/services/token-denylist'
import { initProviders, loadProviderRateLimitsFromSeed } from '../modules/scraping/providers/init-providers'
import { initAdminUser } from '../modules/auth/utils/init-admin'

export async function createServer() {
  const app = Fastify({
    logger: env.NODE_ENV === 'dev',
  }).withTypeProvider<ZodTypeProvider>()

  // Runtime de infraestrutura (embedded in-memory ou web/Redis) â€” usado para
  // iniciar os workers sem conexÃµes no load do mÃ³dulo.
  const runtime = createRuntimeAdapters()

  // â”€â”€ CORS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  await app.register(cors, {
    origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:4173'],
    credentials: true,
  })

  // â”€â”€ Cookies â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  await app.register(cookie, {
    secret: env.JWT_SECRET,
  })

  // Headers de segurança globais (VULN-9/MEC-85) — CSP, HSTS, nosniff,
  // X-Frame-Options, Referrer-Policy etc. aplicados a todas as respostas.
  await app.register(helmet, securityHeadersConfig)

  // â”€â”€ JWT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  await app.register(jwt, {
    secret: env.JWT_SECRET,
    // Aceita o token tambÃ©m via cookie httpOnly (VULN-10 / MEC-86) como
    // fallback quando o Authorization header nÃ£o estÃ¡ presente. O header
    // continua sendo a fonte preferida (compatibilidade com desktop/SSE).
    cookie: {
      cookieName: 'mangaink_token',
      signed: false,
    },
  })

  // Swagger /api-docs gated por env SWAGGER_ENABLED (VULN-9/MEC-85):
  // ativo em dev/test por default, bloqueado em produção; 'true'/'false' força o estado.
  if (env.SWAGGER_ENABLED) {
  // â”€â”€ Swagger / OpenAPI â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'MangaInk Agent API',
        version: '1.0.0',
        description: 'API do sistema MangaInk Agent â€” autenticaÃ§Ã£o, scraping e conversÃ£o de obras.',
        contact: { name: 'MangaInk Agent' },
      },
      servers: [
        {
          url: `http://localhost:${env.PORT}`,
          description: 'Servidor local de desenvolvimento',
        },
      ],
      tags: [
        { name: 'Health', description: 'VerificaÃ§Ã£o do estado da API' },
        { name: 'Auth', description: 'Endpoints de autenticaÃ§Ã£o' },
        { name: 'Scraping', description: 'InspeÃ§Ã£o de fontes e scraping de obras' },
        { name: 'Chapters', description: 'Download e cache de imagens de capÃ­tulos' },
        { name: 'Conversion', description: 'ConversÃ£o de obras para formatos e-reader' },
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

  }
  // â”€â”€ Zod validators â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)

  // â”€â”€ Error handler â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    if (typeof error.statusCode === 'number' && error.statusCode >= 400 && error.statusCode < 600) {
      return reply.code(error.statusCode).send({ error: error.message })
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
    if (error instanceof ProviderBySlugNotFoundError) return reply.code(404).send({ error: error.message })
    if (error instanceof ChapterNotFoundError) return reply.code(404).send({ error: error.message })
    if (error instanceof PageNotFoundError) return reply.code(404).send({ error: error.message })
    if (error instanceof InvalidPageIndexError) return reply.code(400).send({ error: error.message })
    if (error instanceof ChapterDownloadFailedError) return reply.code(500).send({ error: error.message })

    if (error.name === 'ScrapingNetworkError' || error.name === 'ScrapingParseError' || error.name === 'ScrapingError') {
      return reply.code(502).send({ error: error.message })
    }

    if (error instanceof UserAlreadyExistsError) return reply.code(409).send({ error: error.message })
    if (error instanceof InvalidCredentialsError) return reply.code(401).send({ error: error.message })
    if (error instanceof EmailAlreadyInUseError) return reply.code(409).send({ error: error.message })
    if (error instanceof UsernameAlreadyInUseError) return reply.code(409).send({ error: error.message })

    logger.error(
      {
        err: {
          message: error.message,
          name: error.name,
          stack: error.stack,
          code: (error as any).code,
        },
        req: {
          method: _request.method,
          url: _request.url,
          params: _request.params,
          query: _request.query,
        },
      },
      '[Server] Erro interno 500 na requisição',
    )
    const clientMessage =
      env.NODE_ENV === 'production'
        ? 'Erro interno no servidor'
        : (error.message || 'Erro interno no servidor')
    reply.code(500).send({ error: clientMessage })
  })

  // â”€â”€ Rotas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Os produtores de download de capÃ­tulos (use-case/controller) consomem a
  // MESMA fila e status store do worker via runtime. Sem esses setters, o
  // default Ã© o adapter Redis web â€” comportamento legado preservado.
  setChapterDownloadQueue(runtime.getQueue('chapter-download') as IQueueService<ChapterDownloadData>)
  setChapterDownloadStatusStore(runtime.status)
  setInspectOwnerStatusStore(runtime.status)
  setTokenDenylist(createTokenDenylist())

  await app.register(healthRoutes)
  await app.register(authRoutes)
  await app.register(scrapingRoutes, { runtime })
  await app.register(conversionRoutes, { runtime })
  await app.register(mobiPreviewRoutes, { runtime })
  await app.register(chapterRoutes, { runtime })
  await app.register(readingRoutes)

  // Inicia os workers de background (scraping, conversÃ£o, download-only,
  // preview MOBI e download de capÃ­tulos). Em modo embedded, todos rodam sobre
  // as filas in-memory do runtime; em modo web, sobre BullMQ/Redis. Os handles
  // sÃ£o fechados no shutdown via hook onClose.
  if (env.NODE_ENV !== 'test') {
    // Boot resilience: seed/carrega os providers. Falha de banco/migration nÃ£o
    // Boot resilience: seed/carrega os providers. Falha de banco/migration não
    // derruba o boot — o fallback carrega os rate limits do known-providers.ts
    // no registry, evitando que todos os providers caiam no DEFAULT (6/50).
    try {
      await initProviders()
    } catch (err) {
      app.log.warn({ err }, '⚠ initProviders falhou — carregando rate limits do known-providers.ts')
      loadProviderRateLimitsFromSeed()
    }

    try {
      await initAdminUser()
    } catch (err) {
      app.log.warn({ err }, '⚠ initAdminUser falhou ao inicializar admin padrão')
    }

    const workerHandles: QueueWorkerHandle[] = [
      startInspectSourceWorker({ runtime }),
      startConversionJobWorker({ runtime }),
      startDownloadOnlyWorker({ runtime }),
      startMobiPreviewWorker({ runtime }),
      startChapterDownloadWorker({ runtime }),
    ]

    // Sweeper de storage Ã³rfÃ£o de conversÃµes (VULN-8): remove periodicamente
    // diretÃ³rios `storage/conversions/{id}` sem registro no banco.
    const storageSweeperHandle = startConversionStorageSweeper()

    app.addHook('onClose', async () => {
      await Promise.allSettled(workerHandles.map((handle) => handle.close()))
      storageSweeperHandle.close()
    })
  }

  return app
}
