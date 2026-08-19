import { describe, expect, it, vi, beforeEach } from 'vitest'
import { SourceEventsService } from '../../services/source-events.service'

function createMockPubSub() {
  return {
    publish: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn().mockResolvedValue(undefined) }),
    subscribeMany: vi.fn().mockResolvedValue({ unsubscribe: vi.fn().mockResolvedValue(undefined) }),
    unsubscribe: vi.fn().mockResolvedValue(undefined),
    unsubscribeMany: vi.fn().mockResolvedValue(undefined),
  }
}

function createMockReply() {
  return {
    raw: {
      setHeader: vi.fn(),
      flushHeaders: vi.fn(),
      write: vi.fn(),
      end: vi.fn(),
      on: vi.fn(),
    },
  }
}

describe('SourceEventsService', () => {
  let pubsub: ReturnType<typeof createMockPubSub>
  let eventsService: SourceEventsService

  beforeEach(() => {
    pubsub = createMockPubSub()
    eventsService = new SourceEventsService(pubsub as any)
  })

  it('deve configurar headers SSE corretamente', async () => {
    const reply = createMockReply()

    const streamPromise = eventsService.stream('user-1', 'src-test-12345678', reply as any)

    expect(reply.raw.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream')
    expect(reply.raw.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache')
    expect(reply.raw.setHeader).toHaveBeenCalledWith('X-Accel-Buffering', 'no')
    expect(reply.raw.flushHeaders).toHaveBeenCalled()

    await Promise.resolve()
    const closeHandler = reply.raw.on.mock.calls[0][1]
    closeHandler()
    await streamPromise
  })

  it('deve assinar o canal raw source:{sourceId} e enviar progresso', async () => {
    const reply = createMockReply()

    let callback: ((message: string) => void) | null = null
    pubsub.subscribe.mockImplementation((_ch: string, cb: (message: string) => void) => {
      callback = cb
      return { unsubscribe: vi.fn().mockResolvedValue(undefined) }
    })

    const streamPromise = eventsService.stream('user-1', 'src-test-12345678', reply as any)

    expect(pubsub.subscribe).toHaveBeenCalledWith('source:user-1:src-test-12345678', expect.any(Function))
    expect(reply.raw.write).not.toHaveBeenCalled()

    await Promise.resolve()
    callback!(
      JSON.stringify({ stage: 'metadata', progress: 10, message: 'Obtendo informações da obra' }),
    )

    expect(reply.raw.write).toHaveBeenCalledWith(
      `event: progress\ndata: ${JSON.stringify({
        stage: 'metadata',
        message: 'Obtendo informações da obra',
        progress: 10,
      })}\n\n`,
    )

    const closeHandler = reply.raw.on.mock.calls[0][1]
    closeHandler()
    await streamPromise
  })

  it('deve enviar completed e fechar conexão', async () => {
    const reply = createMockReply()

    let callback: ((message: string) => void) | null = null
    pubsub.subscribe.mockImplementation((_ch: string, cb: (message: string) => void) => {
      callback = cb
      return { unsubscribe: vi.fn().mockResolvedValue(undefined) }
    })

    const streamPromise = eventsService.stream('user-1', 'src-test-12345678', reply as any)

    await Promise.resolve()
    callback!(JSON.stringify({ stage: 'completed', progress: 100 }))

    expect(reply.raw.write).toHaveBeenCalledWith(
      `event: completed\ndata: ${JSON.stringify({ sourceId: 'src-test-12345678' })}\n\n`,
    )

    await streamPromise
    expect(reply.raw.end).toHaveBeenCalled()
  })

  it('deve enviar failed com mensagem e fechar conexão', async () => {
    const reply = createMockReply()

    let callback: ((message: string) => void) | null = null
    pubsub.subscribe.mockImplementation((_ch: string, cb: (message: string) => void) => {
      callback = cb
      return { unsubscribe: vi.fn().mockResolvedValue(undefined) }
    })

    const streamPromise = eventsService.stream('user-1', 'src-test-12345678', reply as any)

    await Promise.resolve()
    callback!(JSON.stringify({ stage: 'failed', message: 'Falha ao processar' }))

    expect(reply.raw.write).toHaveBeenCalledWith(
      `event: failed\ndata: ${JSON.stringify({ message: 'Falha ao processar' })}\n\n`,
    )

    await streamPromise
    expect(reply.raw.end).toHaveBeenCalled()
  })

  it('deve fechar conexão ao desconectar cliente', async () => {
    const reply = createMockReply()

    const streamPromise = eventsService.stream('user-1', 'src-test-12345678', reply as any)

    await Promise.resolve()
    const closeHandler = reply.raw.on.mock.calls[0][1]
    closeHandler()
    await streamPromise

    expect(reply.raw.end).not.toHaveBeenCalled()
  })
})


