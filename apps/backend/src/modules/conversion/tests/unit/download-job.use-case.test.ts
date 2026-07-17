import { describe, it, expect, vi } from 'vitest'
import { DownloadJobUseCase } from '../../use-cases/download-job.use-case'

vi.mock('../../../../shared/utils/filesystem', () => ({
  pathExists: vi.fn(async () => true),
  mkdirp: vi.fn(),
  readJson: vi.fn(),
  writeJson: vi.fn(),
}))

vi.mock('../../../../shared/config/env', () => ({
  env: {
    CONVERSIONS_STORAGE_PATH: '/test/storage/conversions',
    STORAGE_PATH: '/test/storage',
    NODE_ENV: 'test',
    PORT: 3333,
    JWT_SECRET: 'test-secret',
    DATABASE_URL: 'postgres://test',
    REDIS_URL: 'redis://test',
    KCC_DOCKER_IMAGE: 'kcc:test',
  },
}))

import {
  ConversionNotFoundError,
  ForbiddenError,
} from '../../errors/conversion.errors'
import type { ConversionRepository } from '../../repositories/conversion.repository'
import type { ConversionJobRepository } from '../../repositories/conversion-job.repository'
import type { ConversionState, ConversionJobState } from '../../types/conversion.types'

const TEST_USER = 'test-user-001'
const OTHER_USER = 'other-user-999'

function makeConversionRepo(found: ConversionState | null) {
  return {
    findById: vi.fn(async (_id: string) => found),
  } as unknown as ConversionRepository
}

function makeJobRepo(found: ConversionJobState | null) {
  return {
    findById: vi.fn(async (_id: string) => found),
  } as unknown as ConversionJobRepository
}

function makeConversionState(overrides: Partial<ConversionState> = {}): ConversionState {
  return {
    conversionId: 'conv_001',
    status: 'completed',
    progress: 100,
    totalJobs: 1,
    completedJobs: 1,
    failedJobs: 0,
    runningJobs: 0,
    pendingJobs: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    jobs: [{ jobId: 'job_001', index: 0, title: 'Vol 1', status: 'completed', progress: 100, outputFile: 'Vol 1.epub' }],
    config: {
      sourceId: 'src-abc',
      cover: { kind: 'original' },
      output: { deviceId: 'kindle_pw5', format: 'EPUB' },
      metadata: { title: 'Test' },
      books: [],
      options: {},
      userId: TEST_USER,
      errorHandlingStrategy: 'ignore',
    },
    ...overrides,
  }
}

function makeJobState(overrides: Partial<ConversionJobState> = {}): ConversionJobState {
  return {
    jobId: 'job_001',
    status: 'completed',
    progress: 100,
    currentStep: 'Done',
    downloadedImages: 10,
    totalImages: 10,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    outputFile: 'Vol 1.epub',
    config: {
      conversionId: 'conv_001',
      jobId: 'job_001',
      bookIndex: 0,
      sourceId: 'src-abc',
      chapters: [],
      cover: { kind: 'original' },
      output: { deviceId: 'kindle_pw5', format: 'EPUB' },
      metadata: { title: 'Vol 1' },
      options: {},
      errorHandlingStrategy: 'ignore',
    },
    ...overrides,
  }
}

describe('DownloadJobUseCase', () => {
  it('lança ConversionNotFoundError quando conversão não existe', async () => {
    const convRepo = makeConversionRepo(null)
    const jobRepo = makeJobRepo(null)
    const useCase = new DownloadJobUseCase(convRepo, jobRepo)

    await expect(
      useCase.execute('conv_inexistente', 'job_001', TEST_USER),
    ).rejects.toThrow(ConversionNotFoundError)
  })

  it('lança ForbiddenError quando userId não é o dono', async () => {
    const convRepo = makeConversionRepo(makeConversionState())
    const jobRepo = makeJobRepo(null)
    const useCase = new DownloadJobUseCase(convRepo, jobRepo)

    await expect(
      useCase.execute('conv_001', 'job_001', OTHER_USER),
    ).rejects.toThrow(ForbiddenError)
  })

  it('resolve o path do arquivo de saída para um job concluído', async () => {
    const convRepo = makeConversionRepo(makeConversionState())
    const jobRepo = makeJobRepo(makeJobState())
    const useCase = new DownloadJobUseCase(convRepo, jobRepo)

    const result = await useCase.execute('conv_001', 'job_001', TEST_USER)

    expect(result.filename).toBe('Vol 1.epub')
    expect(result.filePath).toContain('output')
    expect(result.filePath).toContain('conv_001')
    expect(result.filePath).toContain('job_001')
  })
})
