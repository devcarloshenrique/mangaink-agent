import type { FastifyReply } from 'fastify'
import { ConversionPubSubService } from './conversion-pubsub.service'
import type { SSEEvent, SSEEventType } from '../types/conversion.types'

/**
 * Faz a ponte entre Redis Pub/Sub (eventos internos dos workers) e o
 * SSE exposto ao cliente. Suporta dois modos:
 *
 *  - Por Job: conecta um cliente a um único job.
 *  - Por Conversion: faz fan-in de todos os jobs da Conversion, prefixando
 *    os eventos com `jobId` em `data`.
 */
export class ConversionEventsService {
  constructor(private readonly pubsub: ConversionPubSubService) {}

  createEvent(
    type: SSEEventType,
    data: Record<string, unknown> = {},
  ): SSEEvent {
    return {
      type,
      data,
      timestamp: new Date().toISOString(),
    }
  }

  /** Publica evento de um job no canal do job. */
  async emit(jobId: string, event: SSEEvent): Promise<void> {
    await this.pubsub.publish(jobId, event)
  }

  /** Conecta SSE de um único job. */
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

  /**
   * Conecta SSE fan-in de uma Conversion: encaminha TODOS os eventos
   * dos jobs pertencentes à Conversion, marcando cada um com `jobId`.
   */
  async connectConversionToSSE(jobIds: string[], reply: FastifyReply): Promise<void> {
    this.writeSseHeaders(reply)

    const onMessage = (channel: string, message: string) => {
      try {
        const event = JSON.parse(message) as SSEEvent
        const jobId = channel.replace('conversion-job:', '')
        reply.raw.write(`event: ${event.type}\n`)
        reply.raw.write(`data: ${JSON.stringify({ ...event.data, jobId })}\n\n`)
      } catch {
        // ignora mensagem malformada
      }
    }

    await this.pubsub.subscribeMany(jobIds, onMessage)
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