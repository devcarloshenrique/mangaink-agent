import type { FastifyReply, FastifyRequest } from 'fastify'
import type { SourceParams } from '../dtos/preview-source.dto'
import { SourceEventsService } from '../services/source-events.service'
import { RedisPubSubService } from '../services/redis-pubsub.service'

const pubsub = new RedisPubSubService()
const eventsService = new SourceEventsService(pubsub)

export async function sourceEvents(
  request: FastifyRequest<{ Params: SourceParams }>,
  reply: FastifyReply,
) {
  const { sourceId } = request.params

  await eventsService.stream(sourceId, reply)
}
