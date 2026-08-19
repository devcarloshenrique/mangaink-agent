import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'

const mockPubSub = {
  publish: vi.fn().mockResolvedValue(undefined),
  subscribe: vi.fn().mockResolvedValue({ unsubscribe: vi.fn().mockResolvedValue(undefined) }),
  subscribeMany: vi.fn().mockResolvedValue({ unsubscribe: vi.fn().mockResolvedValue(undefined) }),
  unsubscribe: vi.fn().mockResolvedValue(undefined),
  unsubscribeMany: vi.fn().mockResolvedValue(undefined),
}

const mockJournal = {
  append: vi.fn().mockResolvedValue(undefined),
  range: vi.fn().mockResolvedValue([]),
  nextId: vi.fn().mockResolvedValue(1),
  expire: vi.fn().mockResolvedValue(undefined),
}

import { ChapterDownloadEventsService } from '../../services/chapter-download-events.service'
import type { FastifyReply } from 'fastify'

function createMockReply() {
  const closeCallbacks: Array<() => void> = []
  let isClosed = false
  const reply = {
    raw: {
      writeHead: vi.fn(),
      setHeader: vi.fn(),
      flushHeaders: vi.fn(),
      flush: vi.fn(),
      write: vi.fn(),
      on: vi.fn((event: string, cb: () => void) => {
        if (event === 'close') {
          closeCallbacks.push(cb)
          if (isClosed) {
            queueMicrotask(() => cb())
          }
        }
      }),
      close: () => {
        isClosed = true
        closeCallbacks.forEach((cb) => cb())
      },
    },
  }
  return reply as unknown as FastifyReply & { raw: { close: () => void } }
}

describe('ChapterDownloadEventsService', () => {
  let eventsService: ChapterDownloadEventsService

  beforeEach(() => {
    vi.clearAllMocks()
    eventsService = new ChapterDownloadEventsService(mockPubSub as any, mockJournal as any)
  })

  it('createEvent deve retornar objeto com type, data e timestamp', () => {
    const event = eventsService.createEvent('progress', { downloaded: 5, total: 10 })

    expect(event.type).toBe('progress')
    expect(event.data).toEqual({ downloaded: 5, total: 10 })
    expect(event.timestamp).toEqual(expect.any(String))
    expect(new Date(event.timestamp!).toString()).not.toBe('Invalid Date')
  })

  it('emit deve gravar no journal e publicar no canal raw', async () => {
    const event = eventsService.createEvent('completed', { totalImages: 10, downloaded: 10, errors: 0 })
    mockJournal.nextId.mockResolvedValue(7)

    await eventsService.emit('src-test', 'chap-test', event)

    const idKey = 'chapter-download-event-id:src-test:chap-test'
    const journalKey = 'chapter-download-journal:src-test:chap-test'

    expect(mockJournal.nextId).toHaveBeenCalledWith(idKey)
    expect(mockJournal.append).toHaveBeenCalledWith(
      journalKey,
      expect.objectContaining({ type: 'completed', id: 7 }),
    )
    expect(mockPubSub.publish).toHaveBeenCalledWith(
      'chapter-download:src-test:chap-test',
      expect.objectContaining({ type: 'completed', id: 7 }),
    )
    expect(mockJournal.expire).toHaveBeenCalledWith(journalKey, 3600)
    expect(mockJournal.expire).toHaveBeenCalledWith(idKey, 3600)
  })

  describe('connectToSSE', () => {
    let mockReply: ReturnType<typeof createMockReply>

    beforeEach(() => {
      mockReply = createMockReply()
    })

    it('deve escrever headers SSE e inscrever no canal raw', async () => {
      const promise = eventsService.connectToSSE('src-test', 'chap-test', mockReply as any)
      mockReply.raw.close()
      await promise

      expect(mockReply.raw.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream')
      expect(mockReply.raw.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache')
      expect(mockReply.raw.setHeader).toHaveBeenCalledWith('Connection', 'keep-alive')
      expect(mockReply.raw.setHeader).toHaveBeenCalledWith('X-Accel-Buffering', 'no')
      expect(mockReply.raw.flushHeaders).toHaveBeenCalled()

      expect(mockPubSub.subscribe).toHaveBeenCalledWith(
        'chapter-download:src-test:chap-test',
        expect.any(Function),
      )

      expect(mockJournal.range).toHaveBeenCalledWith(
        'chapter-download-journal:src-test:chap-test',
        0,
        -1,
      )

      expect(mockReply.raw.on).toHaveBeenCalledWith('close', expect.any(Function))
    })

    it('deve fazer replay de eventos do journal via range', async () => {
      const entry1 = {
        type: 'progress',
        data: { downloaded: 1, total: 10 },
        timestamp: '2024-01-01T00:00:00.000Z',
        id: 1,
      }
      const entry2 = {
        type: 'completed',
        data: { totalImages: 10, downloaded: 10, errors: 0 },
        timestamp: '2024-01-01T00:00:01.000Z',
        id: 2,
      }

      mockJournal.range.mockResolvedValue([JSON.stringify(entry1), JSON.stringify(entry2)])

      const promise = eventsService.connectToSSE('src-test', 'chap-test', mockReply as any)
      mockReply.raw.close()
      await promise

      expect(mockReply.raw.write).toHaveBeenCalledTimes(4)
      expect(mockReply.raw.write).toHaveBeenNthCalledWith(1, `event: progress\n`)
      expect(mockReply.raw.write).toHaveBeenNthCalledWith(
        2,
        `data: ${JSON.stringify(entry1.data)}\n\n`,
      )
      expect(mockReply.raw.write).toHaveBeenNthCalledWith(3, `event: completed\n`)
      expect(mockReply.raw.write).toHaveBeenNthCalledWith(
        4,
        `data: ${JSON.stringify(entry2.data)}\n\n`,
      )
    })
  })
})
