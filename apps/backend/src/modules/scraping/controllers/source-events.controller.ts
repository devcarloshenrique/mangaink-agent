import type { FastifyReply, FastifyRequest } from 'fastify'
import type { SourceParams } from '../dtos/preview-source.dto'
import type { RuntimeAdapters } from '../../../shared/infra/factory'
import { SourceEventsService } from '../services/source-events.service'
import { RedisPubSubAdapter } from '../../../shared/infra/redis'
import { getInspectOwner } from '../services/inspect-owner-status-store'

/**
 * Factory do handler SSE de progresso do scraping. Recebe o `runtime` para
 * usar o Pub/Sub compartilhado (in-memory no embedded, Redis no web). Sem
 * runtime, usa o `RedisPubSubAdapter` default — comportamento web preservado.
 *
 * O canal SSE é escopado ao usuário dono do job (`request.user.sub`): o worker
 * publica em `source:{userId}:{sourceId}`, então um usuário que conecta ao SSE
 * de um sourceId cuja inspeção pertence a outro usuário recebe 403.
 */
export function createSourceEventsController(runtime?: RuntimeAdapters) {
  const pubsub = runtime ? runtime.pubsub : new RedisPubSubAdapter()
  const eventsService = new SourceEventsService(pubsub)

  return async function sourceEvents(request: FastifyRequest, reply: FastifyReply) {
    const { sourceId } = request.params as SourceParams
    const userId = (request.user as { sub: string }).sub

    const owner = await getInspectOwner(sourceId)
    if (owner && owner !== userId) {
      return reply.code(403).send({ error: 'Você não pode observar o scraping de outro usuário' })
    }

    reply.hijack()
    await eventsService.stream(userId, sourceId, reply)
  }
}
