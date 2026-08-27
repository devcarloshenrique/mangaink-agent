import { describe, it, expect, vi } from 'vitest'
import { InMemoryPubSub } from '../../../../shared/infra/inmemory/inmemory-pubsub.service'
import { InMemoryJournalStore } from '../../../../shared/infra/inmemory/inmemory-journal-store.service'
import { ConversionEventsService } from '../../services/conversion-events.service'

/**
 * Regressão do bug do unsubscribe blanket: quando UMA conexão SSE fechava,
 * o `unsubscribeMany` apagava os listeners de TODAS as conexões inscritas
 * nos mesmos canais (ex.: página de progresso matava o sino do header).
 * O close agora usa o handle escopado da própria conexão.
 */
function createMockFastifyReply() {
  const chunks: string[] = []
  const closeCallbacks: Array<() => void> = []
  let isClosed = false
  const reply = {
    raw: {
      write: vi.fn((chunk: string) => {
        chunks.push(chunk)
      }),
      on: vi.fn((event: string, cb: () => void) => {
        if (event === 'close') {
          closeCallbacks.push(cb)
          if (isClosed) queueMicrotask(() => cb())
        }
      }),
      close: () => {
        isClosed = true
        closeCallbacks.forEach((cb) => cb())
      },
      writeHead: vi.fn(),
      setHeader: vi.fn(),
      flushHeaders: vi.fn(),
      flush: vi.fn(),
    },
  }
  return { reply, chunks }
}

function sseEvent(id: number, type: string) {
  return JSON.stringify({ id, type, data: {}, timestamp: new Date().toISOString() })
}

describe('ConversionEventsService — múltiplos assinantes no mesmo canal', () => {
  it('fechar a conexão A não silencia a conexão B', async () => {
    const pubsub = new InMemoryPubSub()
    const journal = new InMemoryJournalStore()
    const events = new ConversionEventsService(pubsub, journal)

    const connA = createMockFastifyReply()
    const connB = createMockFastifyReply()

    const promiseA = events.connectConversionToSSE(['job_x'], connA.reply as never)
    const promiseB = events.connectConversionToSSE(['job_x'], connB.reply as never)
    await Promise.resolve()

    // Ambas recebem o evento live antes de qualquer close.
    await pubsub.publish('conversion-job:job_x', sseEvent(1, 'download.started'))
    expect(connA.chunks.join('')).toContain('download.started')
    expect(connB.chunks.join('')).toContain('download.started')

    // Conexão A fecha (usuário saiu da página de progresso).
    connA.reply.raw.close()
    await promiseA

    // Conexão B DEVE continuar recebendo eventos.
    await pubsub.publish('conversion-job:job_x', sseEvent(2, 'conversion.progress'))
    expect(connB.chunks.join('')).toContain('conversion.progress')

    connB.reply.raw.close()
    await promiseB
  })
})
