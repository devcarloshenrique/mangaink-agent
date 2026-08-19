import type { FastifyReply } from 'fastify'
import type { IPubSub, IJournalStore } from '../../../shared/infra'
import { applySseSecurityHeaders } from '../../../shared/utils/security-headers'

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

    await this.journal.append(journalKey, journalEntry)
    await this.pubsub.publish(this.channel(sourceId, chapterId), journalEntry)
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

    const onMessage = (message: unknown) => {
      try {
        const event = (typeof message === 'string' ? JSON.parse(message) : message) as SSEEvent

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
        const event = (typeof entry === 'string' ? JSON.parse(entry) : entry) as SSEEvent
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

    let resolveStream: (() => void) | undefined
    const streamDone = new Promise<void>((resolve) => {
      resolveStream = resolve
    })

    const keepAlive = this.startKeepAlive(reply)
    reply.raw.on('close', async () => {
      clearInterval(keepAlive)
      await this.pubsub.unsubscribe(this.channel(sourceId, chapterId), onMessage).catch(() => {})
      resolveStream?.()
    })

    return streamDone
  }

  private writeSseHeaders(reply: FastifyReply): void {
    reply.raw.setHeader?.('Content-Type', 'text/event-stream')
    reply.raw.setHeader?.('Cache-Control', 'no-cache')
    reply.raw.setHeader?.('Connection', 'keep-alive')
    reply.raw.setHeader?.('X-Accel-Buffering', 'no')
    applySseSecurityHeaders(reply.raw)
    reply.raw.flushHeaders?.()
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
