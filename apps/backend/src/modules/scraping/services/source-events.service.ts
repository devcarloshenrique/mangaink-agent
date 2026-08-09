import type { FastifyReply } from 'fastify'
import type { IPubSub } from '../../../shared/infra'

export type ProgressStage = 'metadata' | 'chapters' | 'covers' | 'completed' | 'failed'

export interface ProgressMessage {
  stage: ProgressStage
  progress?: number
  message?: string
}

/**
 * Serviço que faz a bridge entre o Pub/Sub (canal `source:{sourceId}`) e os
 * clientes SSE. Cada cliente que se conecta ao endpoint SSE registra um
 * listener aqui. O payload trafega como string JSON: os call-sites publicam
 * com `JSON.stringify` e o callback faz `JSON.parse`.
 */
export class SourceEventsService {
  constructor(private readonly pubsub: IPubSub) {}

  /**
   * Inicia o streaming SSE para um sourceId.
   * Fica ouvindo o Pub/Sub e envia os eventos para o cliente HTTP.
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

    let resolveStream: (() => void) | undefined
    const streamDone = new Promise<void>((resolve) => {
      resolveStream = resolve
    })

    const handle = await this.pubsub.subscribe(`source:${sourceId}`, (rawMessage) => {
      let msg: ProgressMessage
      try {
        msg = JSON.parse(rawMessage) as ProgressMessage
      } catch {
        return // ignora mensagem malformada
      }

      const finish = () => {
        handle.unsubscribe().finally(() => {
          reply.raw.end()
          resolveStream?.()
        })
      }

      if (msg.stage === 'completed') {
        send('completed', { sourceId })
        finish()
        return
      }

      if (msg.stage === 'failed') {
        send('failed', { message: msg.message ?? 'Erro durante o processamento' })
        finish()
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
      handle.unsubscribe().catch(() => {})
      resolveStream?.()
    })

    return streamDone
  }
}
