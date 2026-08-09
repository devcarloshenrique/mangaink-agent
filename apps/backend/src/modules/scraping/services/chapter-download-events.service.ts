import type { FastifyReply } from 'fastify'
import type { IPubSub, IJournalStore } from '../../../shared/infra'

export interface SSEEvent {
  type: string
  data: Record<string, unknown>
  timestamp?: string // inline do journal
  id?: number
}

/**
 * Bridge SSE para eventos de download de capítulo.
 *
 * Canal raw: `chapter-download:{sourceId}:{chapterId}` (prefixo de
 * responsabilidade do call site). Payload publicado SEMPRE como string JSON.
 * Journal (replay): `chapter-download-journal:` / `chapter-download-event-id:`.
 */
export class ChapterDownloadEventsService {
  private static readonly JOURNAL_TTL = 3600
  private static readonly JOURNAL_PREFIX = 'chapter-download-journal:'
  private static readonly ID_PREFIX = 'chapter-download-event-id:'
  private static readonly CHANNEL_PREFIX = 'chapter-download:'

  constructor(
    private readonly pubsub: IPubSub,
    private readonly journal: IJournalStore,
  ) {}

  createEvent(type: string, data: Record<string, unknown> = {}): SSEEvent {
    return { type, data, timestamp: new Date().toISOString() }
  }

  private channel(sourceId: string, chapterId: string): string {
    return `${ChapterDownloadEventsService.CHANNEL_PREFIX}${sourceId}:${chapterId}`
  }

  async emit(sourceId: string, chapterId: string, event: SSEEvent): Promise<void> {
    const idKey = `${ChapterDownloadEventsService.ID_PREFIX}${sourceId}:${chapterId}`
    const journalKey = `${ChapterDownloadEventsService.JOURNAL_PREFIX}${sourceId}:${chapterId}`
    const id = await this.journal.nextId(idKey)
    const journalEntry: SSEEvent = { ...event, id }
    const payload = JSON.stringify(journalEntry)

    await this.journal.append(journalKey, payload)
    await this.pubsub.publish(this.channel(sourceId, chapterId), payload)
    await this.journal.expire(journalKey, ChapterDownloadEventsService.JOURNAL_TTL)
    await this.journal.expire(idKey, ChapterDownloadEventsService.JOURNAL_TTL)
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

    const onMessage = (message: string) => {
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

    await this.pubsub.subscribe(this.channel(sourceId, chapterId), onMessage)

    const journalKey = `${ChapterDownloadEventsService.JOURNAL_PREFIX}${sourceId}:${chapterId}`
    const entries = await this.journal.range(journalKey, 0, -1)
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
      await this.pubsub.unsubscribe(this.channel(sourceId, chapterId), onMessage)
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
