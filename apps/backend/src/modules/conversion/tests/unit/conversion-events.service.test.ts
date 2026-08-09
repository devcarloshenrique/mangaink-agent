import { describe, it, expect, beforeEach, vi } from 'vitest'

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
    events = new ConversionEventsService(mockPubSub as any, mockJournal as any)
  })

  it('emit deve atribuir id via nextId e gravar no journal (append + expire)', async () => {
    mockJournal.nextId.mockResolvedValue(5)
    const sseEvent = events.createEvent('job.started', { jobId: 'job_001' })

    await events.emit('job_001', sseEvent)

    expect(mockJournal.nextId).toHaveBeenCalledWith('conversion-event-id:job_001')
    expect(mockJournal.append).toHaveBeenCalledWith(
      'conversion-journal:job_001',
      expect.any(String),
    )
    expect(mockJournal.expire).toHaveBeenCalledWith('conversion-journal:job_001', 3600)
    expect(mockJournal.expire).toHaveBeenCalledWith('conversion-event-id:job_001', 3600)
  })

  it('emit deve publicar no canal raw conversion-job:{jobId} com payload string', async () => {
    mockJournal.nextId.mockResolvedValue(10)
    const sseEvent = events.createEvent('job.started', { jobId: 'job_001' })

    await events.emit('job_001', sseEvent)

    expect(mockPubSub.publish).toHaveBeenCalledWith('conversion-job:job_001', expect.any(String))
    const payload = mockPubSub.publish.mock.calls[0][1] as string
    expect(typeof payload).toBe('string')
    const publishedObj = JSON.parse(payload) as Record<string, unknown>
    expect(publishedObj.id).toBe(10)
    expect(publishedObj.type).toBe('job.started')
  })

  it('connectConversionToSSE deve fazer replay de eventos do journal via range', async () => {
    const { reply, chunks } = createMockFastifyReply()
    mockJournal.range.mockResolvedValue([
      JSON.stringify({ id: 1, type: 'job.started', data: { jobId: 'job_a' }, timestamp: '2024-01-01' }),
      JSON.stringify({ id: 2, type: 'download.started', data: { jobId: 'job_a' }, timestamp: '2024-01-02' }),
    ])

    await events.connectConversionToSSE(['job_a'], reply as any)

    expect(mockJournal.range).toHaveBeenCalledWith('conversion-journal:job_a', 0, -1)
    expect(mockPubSub.subscribeMany).toHaveBeenCalledWith(
      ['conversion-job:job_a'],
      expect.any(Function),
    )

    const output = chunks.join('')
    expect(output).toContain('event: job.started')
    expect(output).toContain('event: download.started')
  })

  it('connectConversionToSSE deve filtrar evento live com ID <= lastReplayedId', async () => {
    const { reply, chunks } = createMockFastifyReply()

    mockJournal.range.mockResolvedValue([
      JSON.stringify({ id: 3, type: 'job.started', data: { jobId: 'job_a' }, timestamp: '2024-01-01' }),
    ])

    const subscription: { onMessage?: (ch: string, msg: string) => void } = {}
    mockPubSub.subscribeMany.mockImplementation(async (_ids: string[], callback: any) => {
      subscription.onMessage = callback
    })

    await events.connectConversionToSSE(['job_a'], reply as any)

    subscription.onMessage?.('conversion-job:job_a', JSON.stringify({
      id: 2, type: 'download.started', data: {}, timestamp: '2024-01-02',
    }))

    const output = chunks.join('')
    expect(output).toContain('event: job.started')
    expect(output).not.toContain('download.started')
  })

  it('connectConversionToSSE deve encaminhar evento live com ID > lastReplayedId', async () => {
    const { reply, chunks } = createMockFastifyReply()

    mockJournal.range.mockResolvedValue([
      JSON.stringify({ id: 1, type: 'job.started', data: { jobId: 'job_a' }, timestamp: '2024-01-01' }),
    ])

    const subscription: { onMessage?: (ch: string, msg: string) => void } = {}
    mockPubSub.subscribeMany.mockImplementation(async (_ids: string[], callback: any) => {
      subscription.onMessage = callback
    })

    await events.connectConversionToSSE(['job_a'], reply as any)

    subscription.onMessage?.('conversion-job:job_a', JSON.stringify({
      id: 5, type: 'conversion.started', data: {}, timestamp: '2024-01-02',
    }))

    const output = chunks.join('')
    expect(output).toContain('event: conversion.started')
  })

  it('connectJobToSSE deve assinar o canal raw e escrever eventos', async () => {
    const { reply, chunks } = createMockFastifyReply()

    const subscription: { onMessage?: (msg: string) => void } = {}
    mockPubSub.subscribe.mockImplementation(async (_ch: string, callback: any) => {
      subscription.onMessage = callback
    })

    await events.connectJobToSSE('job_001', reply as any)

    expect(mockPubSub.subscribe).toHaveBeenCalledWith('conversion-job:job_001', expect.any(Function))

    subscription.onMessage?.(JSON.stringify({ id: 1, type: 'download.progress', data: { p: 50 }, timestamp: '2024-01-02' }))

    const output = chunks.join('')
    expect(output).toContain('event: download.progress')
    expect(output).toContain(`data: ${JSON.stringify({ p: 50 })}\n\n`)
  })
})
