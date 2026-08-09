import type { FastifyReply, FastifyRequest } from 'fastify'
import type { RuntimeAdapters } from '../../../shared/infra/factory'
import { RedisPubSubAdapter, RedisJournalAdapter } from '../../../shared/infra/redis'
import { ChapterDownloadEventsService } from '../services/chapter-download-events.service'

interface ChapterParams {
  sourceId: string
  chapterId: string
}

/**
 * Factory do handler SSE de download de capítulo. Usa Pub/Sub + Journal do
 * `runtime` (compartilhados com o worker). Sem runtime, usa adapters Redis
 * default — comportamento web preservado.
 */
export function createChapterDownloadEventsController(runtime?: RuntimeAdapters) {
  const pubsub = runtime ? runtime.pubsub : new RedisPubSubAdapter()
  const journal = runtime ? runtime.journal : new RedisJournalAdapter()
  const eventsService = new ChapterDownloadEventsService(pubsub, journal)

  return async function chapterDownloadEvents(
    request: FastifyRequest<{ Params: ChapterParams }>,
    reply: FastifyReply,
  ) {
    const { sourceId, chapterId } = request.params

    await eventsService.connectToSSE(sourceId, chapterId, reply)
  }
}
