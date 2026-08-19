import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DeleteConversionUseCase } from '../../use-cases/delete-conversion.use-case'
import {
  ConversionNotFoundError,
  ForbiddenError,
} from '../../errors/conversion.errors'
import type { ConversionRepository } from '../../repositories/conversion.repository'
import type { ConversionStorageService } from '../../services/conversion-storage.service'
import type { ConversionState } from '../../types/conversion.types'
import { logger } from '../../../../shared/logging/logger'

const TEST_USER = 'test-user-001'
const OTHER_USER = 'other-user-999'

function makeState(overrides: Partial<ConversionState> = {}): ConversionState {
  return {
    conversionId: 'conv_001',
    status: 'completed',
    progress: 100,
    totalJobs: 0, completedJobs: 0, failedJobs: 0, runningJobs: 0, pendingJobs: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    jobs: [],
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

function makeStorageMock(removeResult = true) {
  return {
    removeConversion: vi.fn(async () => removeResult),
  } as unknown as ConversionStorageService
}

describe('DeleteConversionUseCase', () => {
  let loggerErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    loggerErrorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {})
  })

  it('lança ConversionNotFoundError quando conversão não existe', async () => {
    const repo = {
      findById: vi.fn(async () => null),
      delete: vi.fn(),
    } as unknown as ConversionRepository
    const useCase = new DeleteConversionUseCase(repo, makeStorageMock())

    await expect(
      useCase.execute('conv_inexistente', TEST_USER),
    ).rejects.toThrow(ConversionNotFoundError)
    expect(repo.delete).not.toHaveBeenCalled()
  })

  it('lança ForbiddenError quando userId não é o dono', async () => {
    const repo = {
      findById: vi.fn(async () => makeState()),
      delete: vi.fn(),
    } as unknown as ConversionRepository
    const useCase = new DeleteConversionUseCase(repo, makeStorageMock())

    await expect(
      useCase.execute('conv_001', OTHER_USER),
    ).rejects.toThrow(ForbiddenError)
    expect(repo.delete).not.toHaveBeenCalled()
  })

  it('remove do banco E do storage quando o dono solicita', async () => {
    const state = makeState()
    const repo = {
      findById: vi.fn(async () => state),
      delete: vi.fn(async () => {}),
    } as unknown as ConversionRepository
    const storage = makeStorageMock()
    const useCase = new DeleteConversionUseCase(repo, storage)

    const result = await useCase.execute('conv_001', TEST_USER)

    expect(result.conversionId).toBe('conv_001')
    expect(result.status).toBe('deleted')
    expect(repo.delete).toHaveBeenCalledWith('conv_001')
    expect(storage.removeConversion).toHaveBeenCalledWith('conv_001')
  })

  it('remove o storage DEPOIS do banco (nunca apaga arquivos de conversão viva)', async () => {
    const state = makeState()
    const deleteRepo = vi.fn(async () => {})
    const removeStorage = vi.fn(async () => true)
    const repo = {
      findById: vi.fn(async () => state),
      delete: deleteRepo,
    } as unknown as ConversionRepository
    const useCase = new DeleteConversionUseCase(repo, {
      removeConversion: removeStorage,
    } as unknown as ConversionStorageService)

    await useCase.execute('conv_001', TEST_USER)

    const dbCall = deleteRepo.mock.invocationCallOrder[0]
    const storageCall = removeStorage.mock.invocationCallOrder[0]
    expect(dbCall).toBeLessThan(storageCall)
  })

  it('fallback: se a remoção do storage falhar, registra log e NÃO quebra a resposta', async () => {
    const state = makeState()
    const repo = {
      findById: vi.fn(async () => state),
      delete: vi.fn(async () => {}),
    } as unknown as ConversionRepository
    const storage = makeStorageMock(false)
    const useCase = new DeleteConversionUseCase(repo, storage)

    const result = await useCase.execute('conv_001', TEST_USER)

    expect(result).toEqual({ conversionId: 'conv_001', status: 'deleted' })
    expect(loggerErrorSpy).toHaveBeenCalled()
    expect(storage.removeConversion).toHaveBeenCalledWith('conv_001')
  })
})
