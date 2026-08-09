import type { FastifyReply, FastifyRequest } from 'fastify'
import type { SourceParams } from '../dtos/preview-source.dto'
import type { RuntimeAdapters } from '../../../shared/infra/factory'
import { SourceEventsService } from '../services/source-events.service'
import { RedisPubSubAdapter } from '../../../shared/infra/redis'

/**
 * Factory do handler SSE de progresso do scraping. Recebe o `runtime` para
 * usar o Pub/Sub compartilhado (in-memory no embedded, Redis no web). Sem
 * runtime, usa o `RedisPubSubAdapter` default — comportamento web preservado.
 */
export function createSourceEventsController(runtime?: RuntimeAdapters) {
  const pubsub = runtime ? runtime.pubsub : new RedisPubSubAdapter()
  const eventsService = new SourceEventsService(pubsub)

  return async function sourceEvents(
    request: FastifyRequest<{ Params: SourceParams }>,
    reply: FastifyReply,
  ) {
    const { sourceId } = request.params

    await eventsService.stream(sourceId, reply)
  }
}
