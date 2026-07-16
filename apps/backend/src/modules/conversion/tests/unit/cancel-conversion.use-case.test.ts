import { describe, it, expect, beforeEach, vi } from 'vitest'
import { CancelConversionUseCase } from '../../use-cases/cancel-conversion.use-case'
import { InMemoryConversionRepository } from '../helpers/in-memory-conversion.repository'
import { MockConversionQueueService } from '../helpers/mock-conversion-queue.service'
import { MockConversionEventsService } from '../helpers/mock-conversion-events.service'
import { makeConversionConfig } from '../helpers/fixtures'
import {
  ConversionNotFoundError,
  InvalidConversionStateError,
  ForbiddenError,
} from '../../errors/conversion.errors'
import type { ConversionState, ConversionJobState, ConversionJobStatus } from '../../types/conversion.types'

const TEST_USER = 'test-user-001'
const OTHER_USER = 'other-user-999'

const jobStore = new Map<string, ConversionJobState>()
const updatedJobs = new Map<string, Partial<ConversionJobStatus>>()
const storeSets: Array<{ jobId: string; data: Record<string, unknown> }> = []
const storeGets: Array<{ jobId: string }> = []

const store = vi.hoisted(() => {
  function buildJob(jobId: string, status: string): ConversionJobState {
    return {
      jobId,
      status: status as ConversionJobState['status'],
      progress: 0,
      currentStep: '',
      downloadedImages: 0,
      totalImages: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      config: {
        conversionId: 'conv_test_001',
        jobId,
        bookIndex: 0,
        sourceId: 'src_test',
        chapters: [],
        cover: { kind: 'original' },
        output: { deviceId: 'kindle_pw5', format: 'EPUB' },
        metadata: { title: 'Vol' },
        options: {},
        errorHandlingStrategy: 'ignore',
      },
    }
  }

  return {
    reset: () => {
      jobStore.clear()
      updatedJobs.clear()
      storeSets.length = 0
      storeGets.length = 0
    },
    setJobStatus: (jobId: string, status: string) => {
      jobStore.set(jobId, buildJob(jobId, status))
    },
    mockJobRepo: {
      findById: vi.fn(async (jobId: string): Promise<ConversionJobState | null> => {
        return jobStore.get(jobId) ?? null
      }),
      update: vi.fn(async (jobId: string, updates: Partial<ConversionJobStatus>): Promise<void> => {
        updatedJobs.set(jobId, updates)
      }),
      create: vi.fn(),
      delete: vi.fn(),
      appendLog: vi.fn(),
    },
    mockLiveStore: {
      set: vi.fn(async (jobId: string, data: Record<string, unknown>): Promise<void> => {
        storeSets.push({ jobId, data })
      }),
      get: vi.fn(async (jobId: string): Promise<Record<string, unknown> | null> => {
        storeGets.push({ jobId })
        const job = jobStore.get(jobId)
        return job ? { status: job.status } : null
      }),
      clear: vi.fn(async (): Promise<void> => {}),
    },
  }
})

vi.mock('../../../../shared/database/repositories', () => ({
  getConversionJobRepository: vi.fn(() => store.mockJobRepo),
  getConversionRepository: vi.fn(),
  getSourceRepository: vi.fn(),
}))

vi.mock('../../../../shared/redis/job-status-store', () => ({
  JobLiveStatusStore: vi.fn(() => store.mockLiveStore),
}))

const mockState = (overrides: Partial<ConversionState> = {}): ConversionState => {
  const config = makeConversionConfig()
  return {
    conversionId: 'conv_test_001',
    status: 'processing',
    progress: 30,
    totalJobs: 2,
    completedJobs: 0,
    failedJobs: 0,
    runningJobs: 1,
    pendingJobs: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    jobs: [
      { jobId: 'job_001', index: 0, title: 'Vol 01', status: 'queued', progress: 0 },
      { jobId: 'job_002', index: 1, title: 'Vol 02', status: 'downloading', progress: 50 },
    ],
    config,
    ...overrides,
  }
}

let conversions: InMemoryConversionRepository
let queue: MockConversionQueueService
let events: MockConversionEventsService
let useCase: CancelConversionUseCase

beforeEach(() => {
  store.reset()
  conversions = new InMemoryConversionRepository()
  queue = new MockConversionQueueService()
  events = new MockConversionEventsService()
  useCase = new CancelConversionUseCase(conversions, queue, events)
})

describe('CancelConversionUseCase', () => {
  it('deve cancelar conversão com jobs queued e running', async () => {
    const state = mockState()
    await conversions.create(state)

    store.setJobStatus('job_001', 'queued')
    store.setJobStatus('job_002', 'downloading')

    const result = await useCase.execute('conv_test_001', TEST_USER)

    expect(result.conversionId).toBe('conv_test_001')
    expect(result.status).toBe('cancelled')

    expect(queue.removed).toContain('job_001')

    const cancelledUpdates = Array.from(updatedJobs.entries()).filter(
      ([, u]) => u.status === 'cancelled',
    )
    expect(cancelledUpdates).toHaveLength(1)

    const cancelledSets = storeSets.filter(
      (s) => s.data.status === 'cancelled',
    )
    expect(cancelledSets).toHaveLength(2)

    const cancelledEvents = events.emitted.filter(
      (e) => e.event.type === 'conversion.cancelled',
    )
    expect(cancelledEvents).toHaveLength(1)
    expect(cancelledEvents[0].event.data.conversionId).toBe('conv_test_001')
  })

  it('deve cancelar apenas jobs que estao na fila ou ativos', async () => {
    const state = mockState({
      jobs: [
        { jobId: 'job_001', index: 0, title: 'Vol 01', status: 'queued', progress: 0 },
        { jobId: 'job_002', index: 1, title: 'Vol 02', status: 'completed', progress: 100 },
        { jobId: 'job_003', index: 2, title: 'Vol 03', status: 'preparing', progress: 0 },
      ],
      totalJobs: 3,
      pendingJobs: 1,
      runningJobs: 1,
      completedJobs: 1,
    })
    await conversions.create(state)

    store.setJobStatus('job_001', 'queued')
    store.setJobStatus('job_002', 'completed')
    store.setJobStatus('job_003', 'preparing')

    await useCase.execute('conv_test_001', TEST_USER)

    const cancelledUpdates = Array.from(updatedJobs.entries()).filter(
      ([, u]) => u.status === 'cancelled',
    )
    expect(cancelledUpdates).toHaveLength(1)

    const cancelledSets = storeSets.filter(
      (s) => s.data.status === 'cancelled',
    )
    expect(cancelledSets).toHaveLength(2)

    expect(queue.removed).toContain('job_001')
    expect(queue.removed).not.toContain('job_002')
  })

  it('deve chamar syncStatus apos cancelar os jobs', async () => {
    const state = mockState({
      createdAt: '2020-01-01T00:00:00.000Z',
      updatedAt: '2020-01-01T00:00:00.000Z',
    })
    const createdAt = state.updatedAt
    await conversions.create(state)

    store.setJobStatus('job_001', 'queued')
    store.setJobStatus('job_002', 'downloading')

    await useCase.execute('conv_test_001', TEST_USER)

    const updated = await conversions.findById('conv_test_001')
    expect(updated).not.toBeNull()
    // syncStatus foi chamado — updatedAt mudou
    expect(updated!.updatedAt).not.toBe(createdAt)

    // store.set foi chamado para ambos os jobs
    const cancelledSets = storeSets.filter(
      (s) => s.data.status === 'cancelled',
    )
    expect(cancelledSets).toHaveLength(2)
  })

  it('deve lancar ConversionNotFoundError quando conversao nao existe', async () => {
    await expect(useCase.execute('conv_inexistente', TEST_USER)).rejects.toThrow(
      ConversionNotFoundError,
    )
  })

  it('deve lancar InvalidConversionStateError para conversao ja completed', async () => {
    const state = mockState({
      status: 'completed',
      progress: 100,
      completedJobs: 2,
      runningJobs: 0,
      pendingJobs: 0,
      jobs: [
        { jobId: 'job_001', index: 0, title: 'Vol 01', status: 'completed', progress: 100 },
        { jobId: 'job_002', index: 1, title: 'Vol 02', status: 'completed', progress: 100 },
      ],
    })
    await conversions.create(state)

    await expect(useCase.execute('conv_test_001', TEST_USER)).rejects.toThrow(
      InvalidConversionStateError,
    )
  })

  it('deve lancar InvalidConversionStateError para conversao ja cancelled', async () => {
    const state = mockState({
      status: 'cancelled',
      progress: 0,
      completedJobs: 0,
      failedJobs: 0,
      runningJobs: 0,
      pendingJobs: 0,
      finishedAt: new Date().toISOString(),
    })
    await conversions.create(state)

    await expect(useCase.execute('conv_test_001', TEST_USER)).rejects.toThrow(
      InvalidConversionStateError,
    )
  })

  it('deve lancar InvalidConversionStateError para conversao ja failed', async () => {
    const state = mockState({
      status: 'failed',
      progress: 0,
      completedJobs: 0,
      failedJobs: 2,
      runningJobs: 0,
      pendingJobs: 0,
      finishedAt: new Date().toISOString(),
      jobs: [
        { jobId: 'job_001', index: 0, title: 'Vol 01', status: 'failed', progress: 0, error: 'err' },
        { jobId: 'job_002', index: 1, title: 'Vol 02', status: 'failed', progress: 0, error: 'err' },
      ],
    })
    await conversions.create(state)

    await expect(useCase.execute('conv_test_001', TEST_USER)).rejects.toThrow(
      InvalidConversionStateError,
    )
  })

  it('deve emitir evento conversion.cancelled no canal correto', async () => {
    const state = mockState()
    await conversions.create(state)

    store.setJobStatus('job_001', 'queued')
    store.setJobStatus('job_002', 'queued')

    await useCase.execute('conv_test_001', TEST_USER)

    const cancelledEvents = events.emitted.filter(
      (e) => e.event.type === 'conversion.cancelled',
    )
    expect(cancelledEvents).toHaveLength(1)
    expect(cancelledEvents[0].channel).toBe('conv_test_001')
    expect(cancelledEvents[0].event.data.status).toBe('cancelled')
  })

  it('deve lidar com status partial (permite cancelamento)', async () => {
    const state = mockState({
      status: 'partial',
      progress: 50,
      completedJobs: 1,
      failedJobs: 0,
      runningJobs: 0,
      pendingJobs: 1,
      totalJobs: 2,
      jobs: [
        { jobId: 'job_001', index: 0, title: 'Vol 01', status: 'completed', progress: 100 },
        { jobId: 'job_002', index: 1, title: 'Vol 02', status: 'queued', progress: 0 },
      ],
    })
    await conversions.create(state)

    store.setJobStatus('job_001', 'completed')
    store.setJobStatus('job_002', 'queued')

    const result = await useCase.execute('conv_test_001', TEST_USER)
    expect(result.status).toBe('cancelled')
    expect(queue.removed).toContain('job_002')
  })

  it('deve lancar ForbiddenError quando userId nao corresponde', async () => {
    const state = mockState()
    await conversions.create(state)

    store.setJobStatus('job_001', 'queued')
    store.setJobStatus('job_002', 'downloading')

    await expect(useCase.execute('conv_test_001', OTHER_USER)).rejects.toThrow(ForbiddenError)
  })
})
