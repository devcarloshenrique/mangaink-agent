import type { FastifyReply } from 'fastify'
import type { RedisPubSubService, ProgressMessage } from './redis-pubsub.service'

/**
 * Serviço que faz a bridge entre o Redis Pub/Sub e os clientes SSE.
 * Cada cliente que se conecta ao endpoint SSE registra um listener aqui.
 */
export class SourceEventsService {
  constructor(private readonly pubsub: RedisPubSubService) {}

  /**
   * Inicia o streaming SSE para um sourceId.
   * Fica ouvindo o Redis Pub/Sub e envia os eventos para o cliente HTTP.
   *
   * Fecha a conexão automaticamente ao receber 'completed' ou 'failed'.
   */
  async stream(sourceId: string, reply: FastifyReply): Promise<void> {
    reply.raw.setHeader('Content-Type', 'text/event-stream')
    reply.raw.setHeader('Cache-Control', 'no-cache')
    reply.raw.setHeader('Connection', 'keep-alive')
    reply.raw.setHeader('X-Accel-Buffering', 'no')
    reply.raw.flushHeaders()

    const send = (event: string, data: object) => {
      reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    }

    return new Promise((resolve) => {
      const { unsubscribe } = this.pubsub.subscribe(sourceId, (msg: ProgressMessage) => {
        if (msg.stage === 'completed') {
          send('completed', { sourceId })
          unsubscribe().finally(() => {
            reply.raw.end()
            resolve()
          })
          return
        }

        if (msg.stage === 'failed') {
          send('failed', { message: msg.message ?? 'Erro durante o processamento' })
          unsubscribe().finally(() => {
            reply.raw.end()
            resolve()
          })
          return
        }

        // progress event
        send('progress', {
          stage: msg.stage,
          message: msg.message ?? `Processando: ${msg.stage}`,
          progress: msg.progress,
        })
      })

      // Limpa ao cliente desconectar
      reply.raw.on('close', () => {
        unsubscribe().catch(() => {})
        resolve()
      })
    })
  }
}
