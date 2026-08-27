import { describe, it, expect, vi } from 'vitest'
import type { FastifyReply } from 'fastify'
import { NotificationEventsService } from '../services/notification-events.service'
import type { IPubSub, UnsubscribeHandle } from '../../../shared/infra'

/**
 * Regressões da bridge Pub/Sub → SSE:
 * - entrega de eventos no canal do usuário;
 * - tolerância a mensagens malformadas;
 * - cleanup (unsubscribe + keepalive) no close do socket;
 * - nenhuma write após o fim do stream (write-after-end).
 */
function createMockReply() {
  const chunks: string[] = []
  const closeCallbacks: Array<() => void> = []

  const raw = {
    write: vi.fn((chunk: string) => {
      chunks.push(chunk)
      return true
    }),
    on: vi.fn((event: string, cb: () => void) => {
      if (event === 'close') closeCallbacks.push(cb)
    }),
    setHeader: vi.fn(),
    flushHeaders: vi.fn(),
    destroyed: false,
    get writableEnded() {
      return this._ended
    },
    set writableEnded(value: boolean) {
      this._ended = value
    },
    _ended: false,
    /** Simula o fim do stream pelo cliente/servidor. */
    endStream() {
      this._ended = true
      closeCallbacks.forEach((cb) => cb())
    },
  }
  return { reply: { raw } as unknown as FastifyReply, raw, chunks }
}

function createFakePubSub(messages: ((rawMessage: unknown) => void)[] = []) {
  const unsubscribers: Array<() => Promise<void>> = []
  let deliver: ((rawMessage: unknown) => void) | undefined
  const pubsub: IPubSub = {
    publish: vi.fn(async () => {}),
    subscribe: vi.fn(async (_channel: string, callback: (m: unknown) => void) => {
      deliver = callback
      const handle: UnsubscribeHandle = {
        unsubscribe: vi.fn(async () => {
          unsubscribers.forEach((u) => u())
        }),
      }
      unsubscribers.push(() => handle.unsubscribe())
      return handle
    }),
    subscribeMany: vi.fn(async () => ({ unsubscribe: async () => {} })),
    unsubscribe: vi.fn(async () => {}),
    unsubscribeMany: vi.fn(async () => {}),
  }
  return { pubsub, deliver: () => deliver, unsubscribers }
}

const record = { id: 'n-1', userId: 'user-1', type: 'volume_ready', title: 't' }

describe('NotificationEventsService.stream', () => {
  it('entrega record publicado como objeto no canal user-notifications:{userId}', async () => {
    const { reply, chunks } = createMockReply()
    const { pubsub, deliver } = createFakePubSub()
    const service = new NotificationEventsService(pubsub)

    const done = service.stream('user-1', reply)
    await Promise.resolve()
    expect(pubsub.subscribe).toHaveBeenCalledWith(
      'user-notifications:user-1',
      expect.any(Function),
    )

    deliver()?.(record)
    expect(chunks.join('')).toContain(`event: notification`)
    expect(chunks.join('')).toContain('"id":"n-1"')

    reply.raw.endStream()
    await done
  })

  it('aceita string JSON e ignora mensagens malformadas ou sem id', async () => {
    const { reply, chunks } = createMockReply()
    const { pubsub, deliver } = createFakePubSub()
    const service = new NotificationEventsService(pubsub)

    const done = service.stream('user-1', reply)
    await Promise.resolve()

    deliver()?.(JSON.stringify(record)) // string JSON válida → entrega
    deliver()?.('{quebrado') // JSON inválido → ignorado
    deliver()?.({ semId: true }) // sem id → ignorado
    deliver()?.(null) // null → ignorado

    const output = chunks.join('')
    expect(output).toContain('"id":"n-1"')
    expect(output.match(/event: notification/g)).toHaveLength(1)

    reply.raw.endStream()
    await done
  })

  it('no close faz unsubscribe e para os keepalives', async () => {
    vi.useFakeTimers()
    try {
      const { reply, raw } = createMockReply()
      const { pubsub, unsubscribers } = createFakePubSub()
      const service = new NotificationEventsService(pubsub)

      const done = service.stream('user-1', reply)
      await Promise.resolve()

      // Keepalive antes do close escreve; depois do close, não.
      await vi.advanceTimersByTimeAsync(30_000)
      const writesBeforeClose = raw.write.mock.calls.length
      expect(raw.write).toHaveBeenCalledWith(': keepalive\n\n')

      raw.endStream()
      await done

      await vi.advanceTimersByTimeAsync(120_000)
      expect(unsubscribers[0]).toBeDefined()
      await unsubscribers[0]()
      expect(raw.write.mock.calls.length).toBe(writesBeforeClose)
    } finally {
      vi.useRealTimers()
    }
  })

  it('nunca escreve após o fim do stream (write-after-end)', async () => {
    const { reply, raw, chunks } = createMockReply()
    const { pubsub, deliver } = createFakePubSub()
    const service = new NotificationEventsService(pubsub)

    const done = service.stream('user-1', reply)
    await Promise.resolve()

    // O stream fecha ANTES de o último evento chegar — a corrida não pode
    // estourar ERR_STREAM_WRITE_AFTER_END.
    raw.writableEnded = true
    expect(() => deliver()?.(record)).not.toThrow()
    const writesAtEnd = raw.write.mock.calls.length
    deliver()?.(record)
    expect(raw.write.mock.calls.length).toBe(writesAtEnd)

    // close dispara cleanup normalmente mesmo com writableEnded
    reply.raw.endStream()
    await done
    expect(chunks.join('')).not.toContain('ERR')
  })
})
