import { describe, it, expect, vi } from 'vitest'
import { DeleteConversionUseCase } from '../../use-cases/delete-conversion.use-case'
import {
  ConversionNotFoundError,
  ForbiddenError,
} from '../../errors/conversion.errors'
import type { ConversionRepository } from '../../repositories/conversion.repository'
import type { ConversionState } from '../../types/conversion.types'

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

describe('DeleteConversionUseCase', () => {
  it('lança ConversionNotFoundError quando conversão não existe', async () => {
    const repo = {
      findById: vi.fn(async () => null),
      delete: vi.fn(),
    } as unknown as ConversionRepository
    const useCase = new DeleteConversionUseCase(repo)

    await expect(
      useCase.execute('conv_inexistente', TEST_USER),
    ).rejects.toThrow(ConversionNotFoundError)
  })

  it('lança ForbiddenError quando userId não é o dono', async () => {
    const repo = {
      findById: vi.fn(async () => makeState()),
      delete: vi.fn(),
    } as unknown as ConversionRepository
    const useCase = new DeleteConversionUseCase(repo)

    await expect(
      useCase.execute('conv_001', OTHER_USER),
    ).rejects.toThrow(ForbiddenError)
  })

  it('deleta conversão do repositório quando o dono solicita', async () => {
    const state = makeState()
    const repo = {
      findById: vi.fn(async () => state),
      delete: vi.fn(async () => {}),
    } as unknown as ConversionRepository
    const useCase = new DeleteConversionUseCase(repo)

    const result = await useCase.execute('conv_001', TEST_USER)

    expect(result.conversionId).toBe('conv_001')
    expect(result.status).toBe('deleted')
    expect(repo.delete).toHaveBeenCalledWith('conv_001')
  })
})
