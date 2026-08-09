import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { InspectQueueService } from '../../services/inspect-queue.service'
import type { IQueueService } from '../../../../shared/infra/queue.service'
import type { SourceInspectJob } from '../../types/source.types'

function makeMockQueue() {
  return {
    add: vi.fn(async () => ({
      id: 'job-1',
      name: 'source-inspect',
      data: {} as SourceInspectJob,
      attemptsMade: 0,
    })),
    getJob: vi.fn(),
    removeJob: vi.fn(),
  }
}

describe('InspectQueueService', () => {
  let mockQueue: ReturnType<typeof makeMockQueue>
  let queueService: InspectQueueService

  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(1753891200000)
    mockQueue = makeMockQueue()
    queueService = new InspectQueueService(mockQueue as unknown as IQueueService<SourceInspectJob>)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('delega enqueue para queue.add com jobId timestamp, removeOnComplete e removeOnFail', async () => {
    await queueService.enqueue({
      sourceId: 'src-test-12345678',
      provider: 'mangalivre',
      url: 'https://mangalivre.to/manga/test/',
      refresh: false,
    })

    expect(mockQueue.add).toHaveBeenCalledWith(
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

    expect(mockQueue.add).toHaveBeenCalledWith(
      'source-inspect',
      expect.objectContaining({ refresh: true }),
      expect.any(Object),
    )
  })
})
