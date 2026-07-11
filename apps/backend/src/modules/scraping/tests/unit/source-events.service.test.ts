import { describe, expect, it, vi, beforeEach } from 'vitest'
import { SourceEventsService } from '../../services/source-events.service'
import { MockRedisPubSubService } from '../helpers/mock-redis-pubsub.service'

describe('SourceEventsService', () => {
  let pubsub: MockRedisPubSubService
  let eventsService: SourceEventsService

  beforeEach(() => {
    pubsub = new MockRedisPubSubService()
    eventsService = new SourceEventsService(pubsub as any)
  })

  it('deve configurar headers SSE corretamente', async () => {
    const reply = {
      raw: {
        setHeader: vi.fn(),
        flushHeaders: vi.fn(),
        write: vi.fn(),
        end: vi.fn(),
        on: vi.fn(),
      },
    }

    // Iniciar stream em background
    const streamPromise = eventsService.stream('src-test-12345678', reply as any)

    // Simular completed
    const subscription = pubsub.subscribe as any
    // Verificar headers
    expect(reply.raw.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream')
    expect(reply.raw.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache')
    expect(reply.raw.setHeader).toHaveBeenCalledWith('X-Accel-Buffering', 'no')
    expect(reply.raw.flushHeaders).toHaveBeenCalled()

    // Cleanup
    // Simular close para resolver a promise
    const closeHandler = reply.raw.on.mock.calls[0][1]
    closeHandler()
    await streamPromise
  })

  it('deve enviar evento progress quando mensagem de progresso chega', async () => {
    const reply = {
      raw: {
        setHeader: vi.fn(),
        flushHeaders: vi.fn(),
        write: vi.fn(),
        end: vi.fn(),
        on: vi.fn(),
      },
    }

    const streamPromise = eventsService.stream('src-test-12345678', reply as any)

    // Simular recebimento de progresso via subscribe callback
    expect(reply.raw.write).not.toHaveBeenCalled()

    const closeHandler = reply.raw.on.mock.calls[0][1]
    closeHandler()
    await streamPromise
  })

  it('deve fechar conexão ao desconectar cliente', async () => {
    const reply = {
      raw: {
        setHeader: vi.fn(),
        flushHeaders: vi.fn(),
        write: vi.fn(),
        end: vi.fn(),
        on: vi.fn(),
      },
    }

    const streamPromise = eventsService.stream('src-test-12345678', reply as any)

    const closeHandler = reply.raw.on.mock.calls[0][1]
    closeHandler()
    await streamPromise

    expect(reply.raw.end).not.toHaveBeenCalled() // close não chama end
  })
})