import { describe, it, expect, beforeEach, vi } from 'vitest'
import { CancelConversionUseCase } from '../../use-cases/cancel-conversion.use-case'
import { InMemoryConversionRepository } from '../helpers/in-memory-conversion.repository'
import { MockConversionQueueService } from '../helpers/mock-conversion-queue.service'
import { MockConversionEventsService } from '../helpers/mock-conversion-events.service'
import { makeConversionConfig } from '../helpers/fixtures'
import {
  ConversionNotFoundError,
  InvalidConversionStateError,
} from '../../errors/conversion.errors'
import type { ConversionState } from '../../types/conversion.types'

const jobStatusStore = new Map<string, { status: string }>()
const writtenStatuses = new Map<string, Record<string, unknown>>()

const norm = (p: string) => p.replace(/\\/g, '/')

const shared = vi.hoisted(() => ({
  reset: () => {
    jobStatusStore.clear()
    writtenStatuses.clear()
  },
  setJobStatus: (key: string, status: { status: string }) => jobStatusStore.set(key, status),
  pathExists: vi.fn(async (p: string): Promise<boolean> => {
    return jobStatusStore.has(norm(p))
  }),
  readJson: vi.fn(async <T>(p: string): Promise<T | null> => {
    const entry = jobStatusStore.get(norm(p))
    return (entry ?? null) as T | null
  }),
  writeJson: vi.fn(async <T>(p: string, data: T): Promise<void> => {
    writtenStatuses.set(norm(p), data as Record<string, unknown>)
  }),
}))

vi.mock('../../../../shared/utils/filesystem', () => ({
  pathExists: shared.pathExists,
  readJson: shared.readJson,
  writeJson: shared.writeJson,
}))

vi.mock('../../../../shared/config/env', () => ({
  env: {
    CONVERSIONS_STORAGE_PATH: '/test/conversions',
    STORAGE_PATH: '/test/storage',
    NODE_ENV: 'test',
    PORT: 3333,
    JWT_SECRET: 'test-secret',
    DATABASE_URL: 'postgresql://test',
    REDIS_URL: 'redis://test',
  },
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
  shared.reset()
  conversions = new InMemoryConversionRepository()
  queue = new MockConversionQueueService()
  events = new MockConversionEventsService()
  useCase = new CancelConversionUseCase(conversions, queue, events)
})

describe('CancelConversionUseCase', () => {
  it('deve cancelar conversão com jobs queued e running', async () => {
    const state = mockState()
    await conversions.create(state)

    shared.setJobStatus('/test/conversions/conv_test_001/jobs/job_001/status.json', {
      status: 'queued',
    })
    shared.setJobStatus('/test/conversions/conv_test_001/jobs/job_002/status.json', {
      status: 'downloading',
    })

    const result = await useCase.execute('conv_test_001')

    expect(result.conversionId).toBe('conv_test_001')
    expect(result.status).toBe('cancelled')

    expect(queue.removed).toContain('job_001')

    const cancelledJobs = Array.from(writtenStatuses.values()).filter(
      (s) => s.status === 'cancelled',
    )
    expect(cancelledJobs).toHaveLength(2)

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

    shared.setJobStatus('/test/conversions/conv_test_001/jobs/job_001/status.json', {
      status: 'queued',
    })
    shared.setJobStatus('/test/conversions/conv_test_001/jobs/job_002/status.json', {
      status: 'completed',
    })
    shared.setJobStatus('/test/conversions/conv_test_001/jobs/job_003/status.json', {
      status: 'preparing',
    })

    await useCase.execute('conv_test_001')

    const cancelledJobs = Array.from(writtenStatuses.values()).filter(
      (s) => s.status === 'cancelled',
    )
    expect(cancelledJobs).toHaveLength(2)

    expect(queue.removed).toContain('job_001')
    expect(queue.removed).not.toContain('job_002')
  })

  it('deve chamar syncStatus apos cancelar os jobs', async () => {
    const state = mockState()
    const createdAt = state.updatedAt
    await conversions.create(state)

    shared.setJobStatus('/test/conversions/conv_test_001/jobs/job_001/status.json', {
      status: 'queued',
    })
    shared.setJobStatus('/test/conversions/conv_test_001/jobs/job_002/status.json', {
      status: 'downloading',
    })

    await useCase.execute('conv_test_001')

    const updated = await conversions.findById('conv_test_001')
    expect(updated).not.toBeNull()
    // syncStatus foi chamado — updatedAt mudou
    expect(updated!.updatedAt).not.toBe(createdAt)
    // updatedAt reflete que syncStatus foi executado

    // Jobs foram marcados como cancelled no filesystem
    const cancelledJobs = Array.from(writtenStatuses.values()).filter(
      (s) => s.status === 'cancelled',
    )
    expect(cancelledJobs).toHaveLength(2)
  })

  it('deve lancar ConversionNotFoundError quando conversao nao existe', async () => {
    await expect(useCase.execute('conv_inexistente')).rejects.toThrow(
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

    await expect(useCase.execute('conv_test_001')).rejects.toThrow(
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

    await expect(useCase.execute('conv_test_001')).rejects.toThrow(
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

    await expect(useCase.execute('conv_test_001')).rejects.toThrow(
      InvalidConversionStateError,
    )
  })

  it('deve emitir evento conversion.cancelled no canal correto', async () => {
    const state = mockState()
    await conversions.create(state)

    shared.setJobStatus('/test/conversions/conv_test_001/jobs/job_001/status.json', {
      status: 'queued',
    })
    shared.setJobStatus('/test/conversions/conv_test_001/jobs/job_002/status.json', {
      status: 'queued',
    })

    await useCase.execute('conv_test_001')

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

    shared.setJobStatus('/test/conversions/conv_test_001/jobs/job_001/status.json', {
      status: 'completed',
    })
    shared.setJobStatus('/test/conversions/conv_test_001/jobs/job_002/status.json', {
      status: 'queued',
    })

    const result = await useCase.execute('conv_test_001')
    expect(result.status).toBe('cancelled')
    expect(queue.removed).toContain('job_002')
  })
})
