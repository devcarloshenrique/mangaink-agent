import type { FastifyReply } from 'fastify'
import { ConversionPubSubService } from './conversion-pubsub.service'
import type { SSEEvent, SSEEventType } from '../types/conversion.types'

export class ConversionEventsService {
  private static readonly JOURNAL_TTL = 3600
  private static readonly JOURNAL_PREFIX = 'conversion-journal:'
  private static readonly ID_PREFIX = 'conversion-event-id:'

  constructor(private readonly pubsub: ConversionPubSubService) {}

  createEvent(type: SSEEventType, data: Record<string, unknown> = {}): SSEEvent {
    return { type, data, timestamp: new Date().toISOString() }
  }

  async emit(jobId: string, event: SSEEvent): Promise<void> {
    const idKey = `${ConversionEventsService.ID_PREFIX}${jobId}`
    const journalKey = `${ConversionEventsService.JOURNAL_PREFIX}${jobId}`
    const id = await this.pubsub.pubIncr(idKey)
    const journalEntry: SSEEvent = { ...event, id }
    const payload = JSON.stringify(journalEntry)

    await this.pubsub.pubRpush(journalKey, payload)
    await this.pubsub.publish(jobId, journalEntry)
    await this.pubsub.pubExpire(journalKey, ConversionEventsService.JOURNAL_TTL)
    await this.pubsub.pubExpire(idKey, ConversionEventsService.JOURNAL_TTL)
  }

  async connectJobToSSE(jobId: string, reply: FastifyReply): Promise<void> {
    this.writeSseHeaders(reply)

    const onMessage = this.writeEvent(reply)
    await this.pubsub.subscribe(jobId, onMessage)
    const keepAlive = this.startKeepAlive(reply)

    reply.raw.on('close', async () => {
      clearInterval(keepAlive)
      await this.pubsub.unsubscribe(jobId, onMessage)
    })
  }

  async connectConversionToSSE(jobIds: string[], reply: FastifyReply): Promise<void> {
    this.writeSseHeaders(reply)

    let isReplaying = true
    const lastReplayedId = new Map<string, number>()
    for (const jobId of jobIds) lastReplayedId.set(jobId, 0)
    const liveBuffer: Array<{ jobId: string; event: SSEEvent }> = []

    const writeSseEvent = (event: SSEEvent, jobId: string) => {
      try {
        reply.raw.write(`event: ${event.type}\n`)
        reply.raw.write(`data: ${JSON.stringify({ ...event.data, jobId })}\n\n`)
      } catch {
        // socket fechado
      }
    }

    const onMessage = (channel: string, message: string) => {
      try {
        const event = JSON.parse(message) as SSEEvent
        const jobId = channel.replace('conversion-job:', '')

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

    await this.pubsub.subscribeMany(jobIds, onMessage)

    for (const jobId of jobIds) {
      const journalKey = `${ConversionEventsService.JOURNAL_PREFIX}${jobId}`
      const entries = await this.pubsub.pubLrange(journalKey, 0, -1)
      let maxId = 0
      for (const entry of entries) {
        try {
          const event = JSON.parse(entry) as SSEEvent
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

    const keepAlive = this.startKeepAlive(reply)
    reply.raw.on('close', async () => {
      clearInterval(keepAlive)
      await this.pubsub.unsubscribeMany(jobIds, onMessage)
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

  private writeEvent(reply: FastifyReply): (channel: string, message: string) => void {
    return (_channel: string, message: string) => {
      try {
        const event = JSON.parse(message) as SSEEvent
        reply.raw.write(`event: ${event.type}\n`)
        reply.raw.write(`data: ${JSON.stringify(event.data)}\n\n`)
      } catch {
        // ignora
      }
    }
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