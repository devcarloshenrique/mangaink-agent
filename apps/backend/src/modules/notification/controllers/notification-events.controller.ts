import type { FastifyReply, FastifyRequest } from 'fastify'
import type { RuntimeAdapters } from '../../../shared/infra/factory'
import { RedisPubSubAdapter } from '../../../shared/infra/redis'
import { NotificationEventsService } from '../services/notification-events.service'

/**
 * SSE `GET /api/notifications/events` — feed em tempo real do usuário
 * autenticado (`request.user.sub`). Reaproveita o Pub/Sub do runtime quando
 * disponível (embedded in-memory / web Redis); sem runtime usa o adapter
 * Redis default (comportamento web preservado).
 */
export function createNotificationEventsController(runtime?: RuntimeAdapters) {
  const pubsub = runtime ? runtime.pubsub : new RedisPubSubAdapter()
  const eventsService = new NotificationEventsService(pubsub)

  return async function notificationEvents(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request.user as { sub: string }).sub

    reply.hijack()
    try {
      await eventsService.stream(userId, reply)
    } catch (err) {
      // Falha ao assinar o Pub/Sub após o hijack: sem destruir o socket o
      // cliente ficaria pendurado até o timeout (não há response possível).
      reply.raw.destroy()
      throw err
    }
  }
}
