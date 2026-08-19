import type { FastifyReply } from 'fastify'
import type { IPubSub, IJournalStore } from '../../../shared/infra'
import { applySseSecurityHeaders } from '../../../shared/utils/security-headers'
import type { SSEEvent, SSEEventType } from '../types/conversion.types'

/**
 * Bridge SSE para eventos de Conversion/Job.
 *
 * - Canal raw de Job: `conversion-job:{jobId}` (prefixo de responsabilidade
 *   do call site). O payload publicado é SEMPRE string JSON (JSON.stringify),
 *   compatível com o contrato dos adapters de IPubSub.
 * - Journal (replay): `conversion-journal:{jobId}` + `conversion-event-id:{jobId}`
 *   persistidos via IJournalStore com TTL de 1h.
 */
export class ConversionEventsService {
  private static readonly JOURNAL_TTL = 3600
  private static readonly JOURNAL_PREFIX = 'conversion-journal:'
  private static readonly ID_PREFIX = 'conversion-event-id:'
  private static readonly CHANNEL_PREFIX = 'conversion-job:'

  constructor(
    private readonly pubsub: IPubSub,
    private readonly journal: IJournalStore,
  ) {}

  createEvent(type: SSEEventType, data: Record<string, unknown> = {}): SSEEvent {
    return { type, data, timestamp: new Date().toISOString() }
  }

  async emit(jobId: string, event: SSEEvent): Promise<void> {
    const idKey = `${ConversionEventsService.ID_PREFIX}${jobId}`
    const journalKey = `${ConversionEventsService.JOURNAL_PREFIX}${jobId}`
    const id = await this.journal.nextId(idKey)
    const journalEntry: SSEEvent = { ...event, id }

    await this.journal.append(journalKey, journalEntry)
    await this.pubsub.publish(`${ConversionEventsService.CHANNEL_PREFIX}${jobId}`, journalEntry)
    await this.journal.expire(journalKey, ConversionEventsService.JOURNAL_TTL)
    await this.journal.expire(idKey, ConversionEventsService.JOURNAL_TTL)
  }

  async connectJobToSSE(jobId: string, reply: FastifyReply): Promise<void> {
    this.writeSseHeaders(reply)

    const onMessage = this.writeEvent(reply)
    const handle = await this.pubsub.subscribe(`${ConversionEventsService.CHANNEL_PREFIX}${jobId}`, onMessage)
    const keepAlive = this.startKeepAlive(reply)

    let resolveStream: (() => void) | undefined
    const streamDone = new Promise<void>((resolve) => {
      resolveStream = resolve
    })

    reply.raw.on('close', async () => {
      clearInterval(keepAlive)
      await handle?.unsubscribe().catch(() => {})
      resolveStream?.()
    })

    return streamDone
  }

  async connectConversionToSSE(jobIds: string[], reply: FastifyReply): Promise<void> {
    this.writeSseHeaders(reply)

    let isReplaying = true
    const lastReplayedId = new Map<string, number>()
    for (const jobId of jobIds) lastReplayedId.set(jobId, 0)
    const liveBuffer: Array<{ jobId: string; event: SSEEvent }> = []

    const writeSseEvent = (event: SSEEvent, jobId: string) => {
      try {
        reply.raw.write(`event: ${event.type}\ndata: ${JSON.stringify({ ...event.data, jobId })}\n\n`)
        ;(reply.raw as any).flush?.()
      } catch {
        // socket fechado
      }
    }

    const onMessage = (channel: string, message: unknown) => {
      try {
        const event = (typeof message === 'string' ? JSON.parse(message) : message) as SSEEvent
        const jobId = channel.replace(ConversionEventsService.CHANNEL_PREFIX, '')

        if (isReplaying) {
          liveBuffer.push({ jobId, event })
          return
        }

        const lastId = lastReplayedId.get(jobId) ?? 0
        if (event.id != null && event.id <= lastId) return

        writeSseEvent(event, jobId)
      } catch {
        // ignora mensagem malformada
      }
    }

    await this.pubsub.subscribeMany(
      jobIds.map((j) => `${ConversionEventsService.CHANNEL_PREFIX}${j}`),
      onMessage,
    )

    for (const jobId of jobIds) {
      const journalKey = `${ConversionEventsService.JOURNAL_PREFIX}${jobId}`
      const entries = await this.journal.range(journalKey, 0, -1)
      let maxId = 0
      for (const entry of entries) {
        try {
          const event = (typeof entry === 'string' ? JSON.parse(entry) : entry) as SSEEvent
          writeSseEvent(event, jobId)
          if (event.id != null) maxId = Math.max(maxId, event.id)
        } catch {
          // entrada inválida no journal
        }
      }
      lastReplayedId.set(jobId, maxId)
    }

    isReplaying = false

    for (const { jobId, event } of liveBuffer) {
      const lastId = lastReplayedId.get(jobId) ?? 0
      if (event.id != null && event.id > lastId) {
        writeSseEvent(event, jobId)
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
      await this.pubsub.unsubscribeMany(
        jobIds.map((j) => `${ConversionEventsService.CHANNEL_PREFIX}${j}`),
      ).catch(() => {})
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

  private writeEvent(reply: FastifyReply): (message: unknown) => void {
    return (message: unknown) => {
      try {
        const event = (typeof message === 'string' ? JSON.parse(message) : message) as SSEEvent
        reply.raw.write(`event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`)
        ;(reply.raw as any).flush?.()
      } catch {
        // ignora
      }
    }
  }

  private startKeepAlive(reply: FastifyReply): NodeJS.Timeout {
    return setInterval(() => {
      try {
        reply.raw.write(': keepalive\n\n')
        ;(reply.raw as any).flush?.()
      } catch {
        // socket fechado
      }
    }, 30_000)
  }
}
