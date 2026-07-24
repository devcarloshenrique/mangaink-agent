import type { FastifyReply, FastifyRequest } from 'fastify'
import { ChapterDownloadPubSubService } from '../services/chapter-download-pubsub.service'
import { ChapterDownloadEventsService } from '../services/chapter-download-events.service'

interface ChapterParams {
  sourceId: string
  chapterId: string
}

const pubsub = new ChapterDownloadPubSubService()
const eventsService = new ChapterDownloadEventsService(pubsub)

export async function chapterDownloadEvents(
  request: FastifyRequest<{ Params: ChapterParams }>,
  reply: FastifyReply,
) {
  const { sourceId, chapterId } = request.params

  await eventsService.connectToSSE(sourceId, chapterId, reply)
}
