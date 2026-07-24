import type { FastifyReply } from 'fastify'
import { ChapterDownloadPubSubService } from './chapter-download-pubsub.service'

export interface SSEEvent {
  type: string
  data: Record<string, unknown>
  timestamp?: string // inline do journal
  id?: number
}

export class ChapterDownloadEventsService {
  private static readonly JOURNAL_TTL = 3600
  private static readonly JOURNAL_PREFIX = 'chapter-download-journal:'
  private static readonly ID_PREFIX = 'chapter-download-event-id:'

  constructor(private readonly pubsub: ChapterDownloadPubSubService) {}

  createEvent(type: string, data: Record<string, unknown> = {}): SSEEvent {
    return { type, data, timestamp: new Date().toISOString() }
  }

  async emit(sourceId: string, chapterId: string, event: SSEEvent): Promise<void> {
    const idKey = `${ChapterDownloadEventsService.ID_PREFIX}${sourceId}:${chapterId}`
    const journalKey = `${ChapterDownloadEventsService.JOURNAL_PREFIX}${sourceId}:${chapterId}`
    const id = await this.pubsub.pubIncr(idKey)
    const journalEntry: SSEEvent = { ...event, id }
    const payload = JSON.stringify(journalEntry)

    await this.pubsub.pubRpush(journalKey, payload)
    await this.pubsub.publish(sourceId, chapterId, journalEntry)
    await this.pubsub.pubExpire(journalKey, ChapterDownloadEventsService.JOURNAL_TTL)
    await this.pubsub.pubExpire(idKey, ChapterDownloadEventsService.JOURNAL_TTL)
  }

  async connectToSSE(
    sourceId: string,
    chapterId: string,
    reply: FastifyReply,
  ): Promise<void> {
    this.writeSseHeaders(reply)

    let isReplaying = true
    let lastReplayedId = 0
    const liveBuffer: SSEEvent[] = []

    const writeSse = (event: SSEEvent) => {
      try {
        reply.raw.write(`event: ${event.type}\n`)
        reply.raw.write(`data: ${JSON.stringify(event.data)}\n\n`)
      } catch {
        // socket fechado
      }
    }

    const onMessage = (_channel: string, message: string) => {
      try {
        const event = JSON.parse(message) as SSEEvent

        if (isReplaying) {
          liveBuffer.push(event)
          return
        }

        if (event.id != null && event.id <= lastReplayedId) return
        writeSse(event)
      } catch {
        // ignora mensagem malformada
      }
    }

    await this.pubsub.subscribe(sourceId, chapterId, onMessage)

    const journalKey = `${ChapterDownloadEventsService.JOURNAL_PREFIX}${sourceId}:${chapterId}`
    const entries = await this.pubsub.pubLrange(journalKey, 0, -1)
    for (const entry of entries) {
      try {
        const event = JSON.parse(entry) as SSEEvent
        writeSse(event)
        if (event.id != null) lastReplayedId = Math.max(lastReplayedId, event.id)
      } catch {
        // entrada inválida
      }
    }

    isReplaying = false

    for (const event of liveBuffer) {
      if (event.id != null && event.id > lastReplayedId) {
        writeSse(event)
      }
    }
    liveBuffer.length = 0

    const keepAlive = this.startKeepAlive(reply)
    reply.raw.on('close', async () => {
      clearInterval(keepAlive)
      await this.pubsub.unsubscribe(sourceId, chapterId, onMessage)
    })
  }

  private writeSseHeaders(reply: FastifyReply): void {
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    })
  }

  private startKeepAlive(reply: FastifyReply): NodeJS.Timeout {
    return setInterval(() => {
      try {
        reply.raw.write(': keepalive\n\n')
      } catch {
        // socket fechado
      }
    }, 30_000)
  }
}
