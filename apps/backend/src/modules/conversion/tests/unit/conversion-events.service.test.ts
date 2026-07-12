import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockPubSub = {
  pubIncr: vi.fn().mockResolvedValue(1),
  pubRpush: vi.fn().mockResolvedValue(undefined),
  pubLrange: vi.fn().mockResolvedValue([]),
  pubExpire: vi.fn().mockResolvedValue(undefined),
  publish: vi.fn().mockResolvedValue(undefined),
  subscribe: vi.fn().mockResolvedValue(undefined),
  subscribeMany: vi.fn().mockResolvedValue(undefined),
  unsubscribe: vi.fn().mockResolvedValue(undefined),
  unsubscribeMany: vi.fn().mockResolvedValue(undefined),
}

import { ConversionEventsService } from '../../services/conversion-events.service'

function createMockFastifyReply() {
  const chunks: string[] = []
  const reply = {
    raw: {
      write: vi.fn((chunk: string) => { chunks.push(chunk) }),
      on: vi.fn(),
      writeHead: vi.fn(),
    },
  }
  return { reply, chunks }
}

describe('ConversionEventsService', () => {
  let events: ConversionEventsService

  beforeEach(() => {
    vi.clearAllMocks()
    events = new ConversionEventsService(mockPubSub as any)
  })

  it('emit deve atribuir id via incr e salvar no journal', async () => {
    mockPubSub.pubIncr.mockResolvedValue(5)
    const sseEvent = events.createEvent('job.started', { jobId: 'job_001' })

    await events.emit('job_001', sseEvent)

    expect(mockPubSub.pubIncr).toHaveBeenCalledWith('conversion-event-id:job_001')
    expect(mockPubSub.pubRpush).toHaveBeenCalled()
    expect(mockPubSub.publish).toHaveBeenCalled()
    expect(mockPubSub.pubExpire).toHaveBeenCalled()
  })

  it('emit deve incluir id no payload publicado', async () => {
    mockPubSub.pubIncr.mockResolvedValue(10)
    const sseEvent = events.createEvent('job.started', { jobId: 'job_001' })

    await events.emit('job_001', sseEvent)

    const publishedObj = mockPubSub.publish.mock.calls[0][1] as Record<string, unknown>
    expect(publishedObj.id).toBe(10)
    expect(publishedObj.type).toBe('job.started')
  })

  it('connectConversionToSSE debe fazer replay de eventos do journal', async () => {
    const { reply, chunks } = createMockFastifyReply()
    mockPubSub.pubLrange.mockResolvedValue([
      JSON.stringify({ id: 1, type: 'job.started', data: { jobId: 'job_a' }, timestamp: '2024-01-01' }),
      JSON.stringify({ id: 2, type: 'download.started', data: { jobId: 'job_a' }, timestamp: '2024-01-02' }),
    ])

    await events.connectConversionToSSE(['job_a'], reply as any)

    const output = chunks.join('')
    expect(output).toContain('event: job.started')
    expect(output).toContain('event: download.started')
  })

  it('connectConversionToSSE deve filtrar evento live com ID <= lastReplayedId', async () => {
    const { reply, chunks } = createMockFastifyReply()

    mockPubSub.pubLrange.mockResolvedValue([
      JSON.stringify({ id: 3, type: 'job.started', data: { jobId: 'job_a' }, timestamp: '2024-01-01' }),
    ])

    let cb: ((ch: string, msg: string) => void) | null = null
    mockPubSub.subscribeMany.mockImplementation(async (_ids: string[], callback: any) => {
      cb = callback
    })

    await events.connectConversionToSSE(['job_a'], reply as any)

    if (cb) {
      cb('conversion-job:job_a', JSON.stringify({
        id: 2, type: 'download.started', data: {}, timestamp: '2024-01-02',
      }))
    }

    const output = chunks.join('')
    expect(output).toContain('event: job.started')
    expect(output).not.toContain('download.started')
  })

  it('connectConversionToSSE deve encaminhar evento live com ID > lastReplayedId', async () => {
    const { reply, chunks } = createMockFastifyReply()

    mockPubSub.pubLrange.mockResolvedValue([
      JSON.stringify({ id: 1, type: 'job.started', data: { jobId: 'job_a' }, timestamp: '2024-01-01' }),
    ])

    let cb: ((ch: string, msg: string) => void) | null = null
    mockPubSub.subscribeMany.mockImplementation(async (_ids: string[], callback: any) => {
      cb = callback
    })

    await events.connectConversionToSSE(['job_a'], reply as any)

    if (cb) {
      cb('conversion-job:job_a', JSON.stringify({
        id: 5, type: 'conversion.started', data: {}, timestamp: '2024-01-02',
      }))
    }

    const output = chunks.join('')
    expect(output).toContain('event: conversion.started')
  })
})
