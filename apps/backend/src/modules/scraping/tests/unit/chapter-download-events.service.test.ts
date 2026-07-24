import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'

const mockRedis = {
  rpush: vi.fn().mockResolvedValue(1),
  lrange: vi.fn().mockResolvedValue([]),
  incr: vi.fn().mockResolvedValue(1),
  expire: vi.fn().mockResolvedValue(1),
  publish: vi.fn().mockResolvedValue(1),
  subscribe: vi.fn().mockResolvedValue(undefined),
  unsubscribe: vi.fn().mockResolvedValue(undefined),
  on: vi.fn(),
  quit: vi.fn().mockResolvedValue(undefined),
}

vi.mock('ioredis', () => ({
  default: vi.fn(() => mockRedis),
}))

import { ChapterDownloadPubSubService } from '../../services/chapter-download-pubsub.service'
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
  let pubsub: ChapterDownloadPubSubService
  let eventsService: ChapterDownloadEventsService

  beforeEach(() => {
    vi.clearAllMocks()
    pubsub = new ChapterDownloadPubSubService()
    eventsService = new ChapterDownloadEventsService(pubsub)
  })

  it('createEvent deve retornar objeto com type, data e timestamp', () => {
    const event = eventsService.createEvent('progress', { downloaded: 5, total: 10 })

    expect(event.type).toBe('progress')
    expect(event.data).toEqual({ downloaded: 5, total: 10 })
    expect(event.timestamp).toEqual(expect.any(String))
    expect(new Date(event.timestamp!).toString()).not.toBe('Invalid Date')
  })

  it('emit deve chamar incr, rpush, publish e expire no pubsub', async () => {
    const event = eventsService.createEvent('completed', { totalImages: 10, downloaded: 10, errors: 0 })

    await eventsService.emit('src-test', 'chap-test', event)

    const idKey = 'chapter-download-event-id:src-test:chap-test'
    const journalKey = 'chapter-download-journal:src-test:chap-test'

    expect(mockRedis.incr).toHaveBeenCalledWith(idKey)
    expect(mockRedis.rpush).toHaveBeenCalledWith(
      journalKey,
      expect.stringContaining('"type":"completed"'),
    )
    expect(mockRedis.publish).toHaveBeenCalledWith(
      'chapter-download:src-test:chap-test',
      expect.any(String),
    )
    expect(mockRedis.expire).toHaveBeenCalledWith(journalKey, 3600)
    expect(mockRedis.expire).toHaveBeenCalledWith(idKey, 3600)

    const publishPayload = JSON.parse(mockRedis.publish.mock.calls[0][1])
    expect(publishPayload.type).toBe('completed')
    expect(publishPayload.id).toBe(1)
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

    it('deve escrever headers SSE e inscrever no pubsub', async () => {
      await eventsService.connectToSSE('src-test', 'chap-test', mockReply)

      expect(mockReply.raw.writeHead).toHaveBeenCalledWith(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      })

      expect(mockRedis.subscribe).toHaveBeenCalledWith(
        'chapter-download:src-test:chap-test',
      )

      expect(mockRedis.lrange).toHaveBeenCalledWith(
        'chapter-download-journal:src-test:chap-test',
        0,
        -1,
      )

      expect(mockReply.raw.on).toHaveBeenCalledWith('close', expect.any(Function))
    })

    it('deve fazer replay de eventos do journal via lrange', async () => {
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

      mockRedis.lrange.mockResolvedValue([JSON.stringify(entry1), JSON.stringify(entry2)])

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
