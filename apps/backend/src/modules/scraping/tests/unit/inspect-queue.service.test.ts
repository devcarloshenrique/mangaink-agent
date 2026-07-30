import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { InspectQueueService } from '../../services/inspect-queue.service'

vi.mock('bullmq', () => {
  const mockAdd = vi.fn()
  return {
    Queue: vi.fn(() => ({
      add: mockAdd,
      close: vi.fn(),
    })),
  }
})

describe('InspectQueueService', () => {
  let queueService: InspectQueueService
  let mockAdd: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.spyOn(Date, 'now').mockReturnValue(1753891200000)
    queueService = new InspectQueueService()
    const { Queue } = await import('bullmq')
    mockAdd = (Queue as ReturnType<typeof vi.fn>).mock.results[0].value.add
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('deve enfileirar job com sourceId e timestamp como jobId', async () => {
    await queueService.enqueue({
      sourceId: 'src-test-12345678',
      provider: 'mangalivre',
      url: 'https://mangalivre.to/manga/test/',
      refresh: false,
    })

    expect(mockAdd).toHaveBeenCalledWith(
      'source-inspect',
      {
        sourceId: 'src-test-12345678',
        provider: 'mangalivre',
        url: 'https://mangalivre.to/manga/test/',
        refresh: false,
      },
      {
        jobId: 'src-test-12345678-1753891200000',
        removeOnComplete: true,
        removeOnFail: { count: 5 },
      },
    )
  })

  it('deve retornar nome da fila', () => {
    expect(queueService.getQueueName()).toBe('source-inspect')
  })

  it('deve enfileirar job com refresh true', async () => {
    await queueService.enqueue({
      sourceId: 'src-test-12345678',
      provider: 'mangalivre',
      url: 'https://mangalivre.to/manga/test/',
      refresh: true,
    })

    expect(mockAdd).toHaveBeenCalledWith(
      'source-inspect',
      expect.objectContaining({ refresh: true }),
      expect.any(Object),
    )
  })
})