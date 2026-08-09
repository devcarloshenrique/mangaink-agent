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
  return {
    raw: {
      writeHead: vi.fn(),
      write: vi.fn(),
      on: vi.fn(),
    },
  } as unknown as FastifyReply
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
      expect.stringContaining('"type":"completed"'),
    )
    expect(mockPubSub.publish).toHaveBeenCalledWith(
      'chapter-download:src-test:chap-test',
      expect.any(String),
    )
    expect(mockJournal.expire).toHaveBeenCalledWith(journalKey, 3600)
    expect(mockJournal.expire).toHaveBeenCalledWith(idKey, 3600)

    const publishPayload = JSON.parse(mockPubSub.publish.mock.calls[0][1])
    expect(publishPayload.type).toBe('completed')
    expect(publishPayload.id).toBe(7)
  })

  describe('connectToSSE', () => {
    let mockReply: ReturnType<typeof createMockReply>

    beforeEach(() => {
      vi.useFakeTimers()
      mockReply = createMockReply()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('deve escrever headers SSE e inscrever no canal raw', async () => {
      await eventsService.connectToSSE('src-test', 'chap-test', mockReply)

      expect(mockReply.raw.writeHead).toHaveBeenCalledWith(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      })

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

      await eventsService.connectToSSE('src-test', 'chap-test', mockReply)

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
