import { describe, expect, it, vi, beforeEach } from 'vitest'
import { MobiPreviewQueueService } from '../../services/mobi-preview-queue.service'
import type { IQueueService } from '../../../../shared/infra/queue.service'
import type { MobiPreviewJobData } from '../../use-cases/mobi-preview.use-case'

function makeData(): MobiPreviewJobData {
  return {
    conversionId: 'conv_001',
    jobId: 'job_001',
    outputFile: 'Vol_01.mobi',
  }
}

function makeMockQueue() {
  return {
    add: vi.fn(async () => ({
      id: 'job_001',
      name: 'mobi-preview:job_001',
      data: {} as MobiPreviewJobData,
      attemptsMade: 0,
    })),
    getJob: vi.fn(async () => null),
    removeJob: vi.fn(async () => {}),
  }
}

describe('MobiPreviewQueueService', () => {
  let mockQueue: ReturnType<typeof makeMockQueue>
  let queueService: MobiPreviewQueueService

  beforeEach(() => {
    mockQueue = makeMockQueue()
    queueService = new MobiPreviewQueueService(mockQueue as unknown as IQueueService<MobiPreviewJobData>)
  })

  it('remove job anterior e delega enqueue para queue.add com jobId, attempts 2, backoff 3000 e retenção', async () => {
    const data = makeData()
    const result = await queueService.enqueue(data)

    expect(mockQueue.removeJob).toHaveBeenCalledWith('job_001')
    expect(mockQueue.add).toHaveBeenCalledWith(
      'mobi-preview:job_001',
      data,
      {
        jobId: 'job_001',
        attempts: 2,
        backoff: { type: 'exponential', delay: 3000 },
        removeOnComplete: { count: 50 },
        removeOnFail: { count: 25 },
      },
    )
    expect(result).toEqual({
      id: 'job_001',
      name: 'mobi-preview:job_001',
      data: {},
      attemptsMade: 0,
    })
  })
})
