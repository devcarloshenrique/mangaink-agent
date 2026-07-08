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
import '../modules/scraping/workers/inspect-source.worker'

export async function createServer() {
  const app = Fastify({
    logger: env.NODE_ENV === 'dev',
  }).withTypeProvider<ZodTypeProvider>()

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
    app.log.error(error)
    reply.code(500).send({ error: 'Internal Server Error' })
  })

  // ── Rotas ───────────────────────────────────────────────────────────────────
  await app.register(healthRoutes)
  await app.register(authRoutes)
  await app.register(scrapingRoutes)

  return app
}
