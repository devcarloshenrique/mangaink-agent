import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import type { RuntimeAdapters } from '../../shared/infra/factory'
import { verifyJwt } from '../../shared/middlewares/verify-jwt'
import {
  listNotificationsQuerySchema,
  listNotificationsResponseSchema,
  markReadParamsSchema,
  markReadResponseSchema,
  markAllReadResponseSchema,
} from './dtos/notification.dto'
import {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from './controllers/notification.controllers'
import { createNotificationEventsController } from './controllers/notification-events.controller'
import { clearNotifications } from './controllers/clear-notifications.controller'

const clearResponseSchema = z.object({
  deleted: z.number().int(),
})

interface NotificationRoutesOptions {
  runtime?: RuntimeAdapters
}

export const notificationRoutes: FastifyPluginAsyncZod<NotificationRoutesOptions> = async (
  app,
  opts,
) => {
  app.get(
    '/api/notifications',
    {
      preHandler: [verifyJwt],
      schema: {
        tags: ['Notifications'],
        summary: 'Listar notificações do usuário',
        description:
          'Retorna as notificações mais recentes (atividades em background: fim/falha de conversões e downloads) + contagem de não lidas.',
        querystring: listNotificationsQuerySchema,
        response: {
          200: listNotificationsResponseSchema,
        },
      },
    },
    listNotifications,
  )

  app.patch(
    '/api/notifications/:id/read',
    {
      preHandler: [verifyJwt],
      schema: {
        tags: ['Notifications'],
        summary: 'Marcar notificação como lida',
        description: 'Marca uma notificação do usuário autenticado como lida. 404 se não existir.',
        params: markReadParamsSchema,
        response: {
          200: markReadResponseSchema,
          404: z.object({ error: z.string() }),
        },
      },
    },
    markNotificationRead,
  )

  app.patch(
    '/api/notifications/read-all',
    {
      preHandler: [verifyJwt],
      schema: {
        tags: ['Notifications'],
        summary: 'Marcar todas as notificações como lidas',
        description: 'Marca todas as notificações não lidas do usuário como lidas.',
        response: {
          200: markAllReadResponseSchema,
        },
      },
    },
    markAllNotificationsRead,
  )

  app.delete(
    '/api/notifications',
    {
      preHandler: [verifyJwt],
      schema: {
        tags: ['Notifications'],
        summary: 'Limpar histórico de notificações',
        description: 'Remove TODAS as notificações do usuário autenticado.',
        response: {
          200: clearResponseSchema,
        },
      },
    },
    clearNotifications,
  )

  // SSE — stream hijacked, sem response schema. Usa o runtime para reusar o
  // Pub/Sub compartilhado (embedded in-memory / web Redis).
  app.get(
    '/api/notifications/events',
    {
      preHandler: [verifyJwt],
      schema: {
        tags: ['Notifications'],
        summary: 'Stream SSE de notificações',
        description:
          'Feed em tempo real (`event: notification`) das atividades em background do usuário autenticado.',
        hide: true,
      },
    },
    createNotificationEventsController(opts.runtime),
  )
}
