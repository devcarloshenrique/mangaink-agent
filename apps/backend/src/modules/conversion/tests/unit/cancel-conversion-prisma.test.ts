import { describe, it, expect, beforeEach, vi } from 'vitest'

const shared = vi.hoisted(() => {
  const storeRecords = new Map<string, Record<string, unknown>>()
  const jobRepo = {
    created: [] as Array<{ jobId: string; status: string }>,
    updated: [] as Array<{ jobId: string; updates: Record<string, unknown> }>,
    findById: vi.fn(),
    update: vi.fn(),
    withConversion: vi.fn(function () { return this }),
    create: vi.fn(),
    delete: vi.fn(),
    appendLog: vi.fn(),
  }
  const store = {
    set: vi.fn(async (jobId: string, partial: Record<string, unknown>) => {
      const existing = (storeRecords.get(jobId) ?? {}) as Record<string, unknown>
      for (const [k, v] of Object.entries(partial)) {
        if (v !== undefined) existing[k] = String(v)
      }
      storeRecords.set(jobId, existing)
    }),
    get: vi.fn(async (jobId: string) => storeRecords.get(jobId) ?? null),
    clear: vi.fn(async (jobId: string) => { storeRecords.delete(jobId) }),
    setTerminal: vi.fn(),
  }
  return { storeRecords, jobRepo, store }
})

vi.mock('../../../../shared/config/env', () => ({
  env: {
    CONVERSIONS_STORAGE_PATH: '/test/conversions',
    STORAGE_PATH: '/test/storage',
    NODE_ENV: 'test',
    PORT: 3333,
    JWT_SECRET: 'test-secret',
    DATABASE_URL: 'postgresql://test',
    REDIS_URL: 'redis://test',
    REPO_BACKEND: 'prisma',
    JOB_STATUS_TTL_SEC: 21600,
    KCC_DOCKER_IMAGE: 'mangaink-kcc:10.3.0',
  },
}))

vi.mock('../../../../shared/config/repo-mode', () => ({
  isPrismaBackend: () => true,
  REPO_BACKEND: 'prisma',
}))

vi.mock('../../../../shared/database/repositories', () => ({
  getConversionJobRepository: () => shared.jobRepo,
  getConversionRepository: () => {
    throw new Error('not used in cancel')
  },
  getSourceRepository: () => {
    throw new Error('not used in cancel')
  },
}))

vi.mock('../../../../shared/redis/job-status-store', () => ({
  JobLiveStatusStore: vi.fn(() => shared.store),
}))

vi.mock('../../../../shared/utils/filesystem', () => ({
  pathExists: vi.fn(),
  readJson: vi.fn(),
  writeJson: vi.fn(),
  mkdirp: vi.fn(),
}))

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
import type { ConversionState } from '../../types/conversion.types'

const TEST_USER = 'test-user-prisma-001'
const OTHER_USER = 'other-user-prisma-999'

const mockState = (overrides: Partial<ConversionState> = {}): ConversionState => {
  const config = makeConversionConfig({ userId: TEST_USER })
  return {
    conversionId: 'conv_prisma_001',
    status: 'processing',
    progress: 30,
    totalJobs: 3,
    completedJobs: 0,
    failedJobs: 0,
    runningJobs: 1,
    pendingJobs: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    jobs: [
      { jobId: 'job_p_001', index: 0, title: 'Vol 01', status: 'queued', progress: 0 },
      { jobId: 'job_p_002', index: 1, title: 'Vol 02', status: 'downloading', progress: 50 },
      { jobId: 'job_p_003', index: 2, title: 'Vol 03', status: 'queued', progress: 0 },
    ],
    config,
    ...overrides,
  }
}

describe('CancelConversionUseCase — Prisma branch', () => {
  let conversions: InMemoryConversionRepository
  let queue: MockConversionQueueService
  let events: MockConversionEventsService
  let useCase: CancelConversionUseCase

  beforeEach(() => {
    conversions = new InMemoryConversionRepository()
    queue = new MockConversionQueueService()
    events = new MockConversionEventsService()
    useCase = new CancelConversionUseCase(conversions, queue, events)

    shared.jobRepo.created = []
    shared.jobRepo.updated = []
    shared.jobRepo.findById.mockReset()
    shared.jobRepo.update.mockReset()
    shared.jobRepo.update.mockResolvedValue(undefined)
    shared.storeRecords.clear()
    shared.store.set.mockClear()
    shared.store.clear.mockClear()
  })

  it('deve fazer Redis-first cancel em jobs running', async () => {
    const state = mockState()
    await conversions.create(state)
    shared.jobRepo.findById.mockImplementation(async (jobId: string) => {
      const job = state.jobs.find((j) => j.jobId === jobId)
      return job ? { jobId, status: job.status, config: {} } as any : null
    })

    await useCase.execute('conv_prisma_001', TEST_USER)

    const downloadCalls = shared.store.set.mock.calls.filter(
      ([jobId]: unknown[]) => jobId === 'job_p_002',
    )
    expect(downloadCalls.length).toBeGreaterThanOrEqual(1)
    const runningSet = downloadCalls[0][1] as Record<string, string>
    expect(runningSet.status).toBe('cancelled')

    expect(queue.removed).toContain('job_p_001')
    expect(queue.removed).toContain('job_p_003')
  })

  it('Jobs pendentes são removidos da fila BullMQ e persistidos em Postgres', async () => {
    const state = mockState()
    await conversions.create(state)
    shared.jobRepo.findById.mockImplementation(async (jobId: string) => {
      const job = state.jobs.find((j) => j.jobId === jobId)
      return job ? { jobId, status: job.status, config: {} } as any : null
    })

    await useCase.execute('conv_prisma_001', TEST_USER)

    expect(queue.removed).toContain('job_p_001')
    expect(queue.removed).toContain('job_p_003')

    const updateCalls = shared.jobRepo.update.mock.calls.filter(
      ([jobId]: unknown[]) => jobId === 'job_p_001' || jobId === 'job_p_003',
    )
    expect(updateCalls.length).toBeGreaterThanOrEqual(2)
    for (const [, updates] of updateCalls) {
      expect((updates as Record<string, unknown>).status).toBe('cancelled')
    }
  })

  it('não deve tentar cancelar jobs já terminais', async () => {
    const state = mockState({
      jobs: [
        { jobId: 'job_p_001', index: 0, title: 'Vol 01', status: 'completed', progress: 100 },
        { jobId: 'job_p_002', index: 1, title: 'Vol 02', status: 'failed', progress: 0 },
        { jobId: 'job_p_003', index: 2, title: 'Vol 03', status: 'queued', progress: 0 },
      ],
    })
    await conversions.create(state)
    shared.jobRepo.findById.mockImplementation(async (jobId: string) => {
      const job = state.jobs.find((j) => j.jobId === jobId)
      return job ? { jobId, status: job.status, config: {} } as any : null
    })

    await useCase.execute('conv_prisma_001', TEST_USER)

    expect(queue.removed).toContain('job_p_003')
    expect(queue.removed).not.toContain('job_p_001')
    expect(queue.removed).not.toContain('job_p_002')
  })

  it('deve emitir evento conversion.cancelled', async () => {
    const state = mockState()
    await conversions.create(state)
    shared.jobRepo.findById.mockImplementation(async (jobId: string) => {
      const job = state.jobs.find((j) => j.jobId === jobId)
      return job ? { jobId, status: job.status, config: {} } as any : null
    })

    await useCase.execute('conv_prisma_001', TEST_USER)

    const cancelledEvents = events.emitted.filter(
      (e) => e.event.type === 'conversion.cancelled',
    )
    expect(cancelledEvents).toHaveLength(1)
    expect(cancelledEvents[0].channel).toBe('conv_prisma_001')
  })

  it('deve rejeitar usuário não autorizado (forbidden)', async () => {
    const state = mockState()
    await conversions.create(state)

    await expect(
      useCase.execute('conv_prisma_001', OTHER_USER),
    ).rejects.toThrow(ForbiddenError)
  })

  it('deve rejeitar conversão inexistente (not found)', async () => {
    await expect(
      useCase.execute('conv_nao_existe', TEST_USER),
    ).rejects.toThrow(ConversionNotFoundError)
  })

  it('deve rejeitar conversão já terminal', async () => {
    const state = mockState({ status: 'completed' })
    await conversions.create(state)

    await expect(
      useCase.execute('conv_prisma_001', TEST_USER),
    ).rejects.toThrow(InvalidConversionStateError)
  })
})
