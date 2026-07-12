import { describe, it, expect, beforeEach } from 'vitest'
import { GetConversionUseCase } from '../../use-cases/get-conversion.use-case'
import { InMemoryConversionRepository } from '../helpers/in-memory-conversion.repository'
import { ConversionNotFoundError, ForbiddenError } from '../../errors/conversion.errors'
import { makeConversionConfig } from '../helpers/fixtures'
import type { ConversionState } from '../../types/conversion.types'

const TEST_USER = 'test-user-001'
const OTHER_USER = 'other-user-999'

let conversions: InMemoryConversionRepository
let useCase: GetConversionUseCase

const mockState = (overrides: Partial<ConversionState> = {}): ConversionState => {
  const config = makeConversionConfig()
  return {
    conversionId: 'conv_test_001',
    status: 'queued',
    progress: 0,
    totalJobs: 1,
    completedJobs: 0,
    failedJobs: 0,
    runningJobs: 0,
    pendingJobs: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    jobs: [
      { jobId: 'job_001', index: 0, title: 'Vol 01', status: 'queued', progress: 0 },
    ],
    config,
    ...overrides,
  }
}

beforeEach(() => {
  conversions = new InMemoryConversionRepository()
  useCase = new GetConversionUseCase(conversions)
})

describe('GetConversionUseCase', () => {
  it('deve retornar estado da conversão após syncStatus', async () => {
    await conversions.create(mockState({ conversionId: 'conv_test_001' }))

    const result = await useCase.execute('conv_test_001', TEST_USER)

    expect(result.conversionId).toBe('conv_test_001')
    expect(result.status).toBe('queued')
    expect(result.totalJobs).toBe(1)
    expect(result.pendingJobs).toBe(1)
    expect(result.jobs).toHaveLength(1)
  })

  it('deve retornar estado com status processing quando jobs estão ativos', async () => {
    await conversions.create(
      mockState({
        conversionId: 'conv_test_002',
        status: 'processing',
        progress: 50,
        runningJobs: 1,
        pendingJobs: 0,
        jobs: [
          { jobId: 'job_001', index: 0, title: 'Vol 01', status: 'downloading', progress: 50 },
        ],
      }),
    )

    const result = await useCase.execute('conv_test_002', TEST_USER)

    expect(result.status).toBe('processing')
    expect(result.progress).toBe(50)
    expect(result.runningJobs).toBe(1)
  })

  it('deve retornar estado completed quando todos os jobs terminaram', async () => {
    await conversions.create(
      mockState({
        conversionId: 'conv_test_003',
        status: 'completed',
        progress: 100,
        completedJobs: 2,
        runningJobs: 0,
        pendingJobs: 0,
        jobs: [
          { jobId: 'job_001', index: 0, title: 'Vol 01', status: 'completed', progress: 100 },
          { jobId: 'job_002', index: 1, title: 'Vol 02', status: 'completed', progress: 100 },
        ],
      }),
    )

    const result = await useCase.execute('conv_test_003', TEST_USER)

    expect(result.status).toBe('completed')
    expect(result.progress).toBe(100)
    expect(result.completedJobs).toBe(2)
  })

  it('deve retornar estado partial quando há jobs failed junto com completed', async () => {
    await conversions.create(
      mockState({
        conversionId: 'conv_test_004',
        status: 'partial',
        progress: 60,
        completedJobs: 1,
        failedJobs: 1,
        totalJobs: 2,
        runningJobs: 0,
        pendingJobs: 0,
        jobs: [
          { jobId: 'job_001', index: 0, title: 'Vol 01', status: 'completed', progress: 100 },
          { jobId: 'job_002', index: 1, title: 'Vol 02', status: 'failed', progress: 20, error: 'Erro KCC' },
        ],
      }),
    )

    const result = await useCase.execute('conv_test_004', TEST_USER)

    expect(result.status).toBe('partial')
    expect(result.completedJobs).toBe(1)
    expect(result.failedJobs).toBe(1)
  })

  it('deve lançar ConversionNotFoundError quando conversão não existe', async () => {
    await expect(useCase.execute('conv_inexistente', TEST_USER)).rejects.toThrow(ConversionNotFoundError)
  })

  it('deve lançar ConversionNotFoundError com código CONVERSION_NOT_FOUND', async () => {
    try {
      await useCase.execute('conv_inexistente', TEST_USER)
    } catch (err) {
      expect(err).toBeInstanceOf(ConversionNotFoundError)
      expect((err as ConversionNotFoundError).code).toBe('CONVERSION_NOT_FOUND')
    }
  })

  it('deve lançar ForbiddenError quando userId não corresponde', async () => {
    await conversions.create(mockState({ conversionId: 'conv_test_005' }))

    await expect(useCase.execute('conv_test_005', OTHER_USER)).rejects.toThrow(ForbiddenError)
  })
})
