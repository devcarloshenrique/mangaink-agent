import { describe, expect, it, vi, beforeEach } from 'vitest'
import { ConversionQueueService } from '../../services/conversion-queue.service'
import type { IQueueService } from '../../../../shared/infra/queue.service'
import type { ConversionJobData } from '../../types/conversion.types'

function makeData(): ConversionJobData {
  return {
    conversionId: 'conv_001',
    jobId: 'job_001',
    bookIndex: 0,
    sourceId: 'src_001',
    chapters: ['chap_0001'],
    cover: { kind: 'original' },
    output: { deviceId: 'kindle_pw5', format: 'EPUB' },
    metadata: { title: 'Vol 01', author: 'Author' },
    options: {},
    storagePath: '/tmp/conv_001/jobs/job_001',
  }
}

function makeMockQueue() {
  return {
    add: vi.fn(async () => ({
      id: 'job_001',
      name: 'conversion:job_001',
      data: {} as ConversionJobData,
      attemptsMade: 0,
    })),
    getJob: vi.fn(),
    removeJob: vi.fn(),
  }
}

describe('ConversionQueueService', () => {
  let mockQueue: ReturnType<typeof makeMockQueue>
  let queueService: ConversionQueueService

  beforeEach(() => {
    mockQueue = makeMockQueue()
    queueService = new ConversionQueueService(mockQueue as unknown as IQueueService<ConversionJobData>)
  })

  it('delega enqueue para queue.add com jobId, attempts:1 (sem auto-retry) e retenção', async () => {
    const data = makeData()
    const result = await queueService.enqueue(data)

    expect(mockQueue.add).toHaveBeenCalledWith(
      'conversion:job_001',
      data,
      {
        jobId: 'job_001',
        attempts: 1,
        removeOnComplete: { count: 50 },
        removeOnFail: { count: 25 },
      },
    )
    expect(result).toEqual({
      id: 'job_001',
      name: 'conversion:job_001',
      data: {},
      attemptsMade: 0,
    })
  })

  it('remove delega para queue.removeJob', async () => {
    await queueService.remove('job_001')
    expect(mockQueue.removeJob).toHaveBeenCalledWith('job_001')
  })

  it('getJob delega para queue.getJob e retorna null quando não existe', async () => {
    mockQueue.getJob.mockResolvedValue(null)
    const result = await queueService.getJob('job_001')
    expect(mockQueue.getJob).toHaveBeenCalledWith('job_001')
    expect(result).toBeNull()
  })

  it('getJob retorna o job encontrado', async () => {
    mockQueue.getJob.mockResolvedValue({
      id: 'job_001',
      name: 'conversion:job_001',
      data: makeData(),
      attemptsMade: 0,
    })
    const result = await queueService.getJob('job_001')
    expect(result?.id).toBe('job_001')
    expect(result?.name).toBe('conversion:job_001')
  })
})
