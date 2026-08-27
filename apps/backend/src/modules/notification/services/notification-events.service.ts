import type { FastifyReply } from 'fastify'
import type { IPubSub } from '../../../shared/infra'
import { applySseSecurityHeaders } from '../../../shared/utils/security-headers'
import { USER_NOTIFICATIONS_CHANNEL } from './notification.service'
import type { NotificationRecord } from '../types/notification.types'

const KEEPALIVE_INTERVAL_MS = 30_000

/**
 * Bridge Pub/Sub → SSE para o feed de notificações do usuário autenticado.
 * Canal: `user-notifications:{userId}`. O stream permanece aberto até o
 * cliente desconectar (não há evento terminal — notificações chegam a qualquer
 * momento). Sem journal/replay: a lista atual é buscada via GET /api/notifications
 * no mount; o SSE cobre apenas eventos novos.
 */
export class NotificationEventsService {
  constructor(private readonly pubsub: IPubSub) {}

  async stream(userId: string, reply: FastifyReply): Promise<void> {
    reply.raw.setHeader('Content-Type', 'text/event-stream')
    reply.raw.setHeader('Cache-Control', 'no-cache')
    reply.raw.setHeader('Connection', 'keep-alive')
    reply.raw.setHeader('X-Accel-Buffering', 'no')
    applySseSecurityHeaders(reply.raw)
    reply.raw.flushHeaders()

    /** Escrita segura: ignora writes após o cliente fechar (write-after-end). */
    const isClosed = () => reply.raw.writableEnded || reply.raw.destroyed
    const send = (event: string, data: object) => {
      if (isClosed()) return
      reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    }

    let resolveStream: (() => void) | undefined
    const streamDone = new Promise<void>((resolve) => {
      resolveStream = resolve
    })

    const handle = await this.pubsub.subscribe(
      `${USER_NOTIFICATIONS_CHANNEL}:${userId}`,
      (rawMessage) => {
        // O adapter entrega objeto; aceita string JSON por robustez
        // (ex.: publish externo via redis-cli).
        let record: NotificationRecord | undefined
        if (typeof rawMessage === 'string') {
          try {
            record = JSON.parse(rawMessage) as NotificationRecord
          } catch {
            return // ignora mensagem malformada
          }
        } else {
          record = rawMessage as NotificationRecord
        }
        if (!record?.id) return
        send('notification', record)
      },
    )

    const keepalive = setInterval(() => {
      if (isClosed()) {
        clearInterval(keepalive)
        return
      }
      reply.raw.write(': keepalive\n\n')
    }, KEEPALIVE_INTERVAL_MS)

    const cleanup = () => {
      clearInterval(keepalive)
      handle.unsubscribe().catch(() => {})
      resolveStream?.()
    }

    reply.raw.on('close', cleanup)

    return streamDone
  }
}
