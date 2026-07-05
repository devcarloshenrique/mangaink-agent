import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { healthCheck } from './health.controller'

export async function healthRoutes(app: FastifyInstance) {
  app.get(
    '/api/health',
    {
      schema: {
        tags: ['Health'],
        summary: 'Verifica o estado da API',
        description: 'Retorna o status atual da API, uptime e versão.',
        response: {
          200: z.object({
            status: z.string(),
            timestamp: z.string().datetime(),
            version: z.string(),
            uptime: z.number(),
          }),
        },
      },
    },
    healthCheck,
  )
}
