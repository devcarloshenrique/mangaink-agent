import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GetConversionLogsUseCase } from '../../use-cases/get-conversion-logs.use-case'
import { GetConversionUseCase } from '../../use-cases/get-conversion.use-case'
import { ConversionPubSubService } from '../../services/conversion-pubsub.service'
import { ConversionNotFoundError, ForbiddenError } from '../../errors/conversion.errors'
import type { ConversionState, SSEEvent } from '../../types/conversion.types'
import { makeConversionConfig } from '../helpers/fixtures'

const TEST_USER = 'test-user-001'
const OTHER_USER = 'other-user-999'

const mockGetConversion = {
  execute: vi.fn(),
} as unknown as GetConversionUseCase

const mockPubsub = {
  pubLrange: vi.fn(),
} as unknown as ConversionPubSubService

let useCase: GetConversionLogsUseCase

function makeState(overrides: Partial<ConversionState> = {}): ConversionState {
  const config = makeConversionConfig()
  return {
    conversionId: 'conv_test_001',
    status: 'completed' as const,
    progress: 100,
    totalJobs: 1,
    completedJobs: 1,
    failedJobs: 0,
    runningJobs: 0,
    pendingJobs: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    jobs: [
      { jobId: 'job_001', index: 0, title: 'Vol 01', status: 'completed', progress: 100 },
    ],
    config,
    ...overrides,
  }
}

function makeJournalEntry(overrides: Partial<SSEEvent> = {}): SSEEvent {
  return {
    type: 'download.chapter.started',
    data: { chapterId: 'chap_0001', totalImages: 20, fromCache: false },
    timestamp: new Date().toISOString(),
    id: 1,
    ...overrides,
  }
}

const journalEntries = JSON.stringify(makeJournalEntry())
const journalEntries2 = JSON.stringify(makeJournalEntry({
  type: 'conversion.started',
  data: { deviceId: 'K11', format: 'EPUB' },
  id: 2,
}))
const journalEntries3 = JSON.stringify(makeJournalEntry({
  type: 'job.finished',
  data: { outputFile: 'Vol_01.epub', outputSize: 5_242_880 },
  id: 3,
}))

beforeEach(() => {
  vi.clearAllMocks()
  useCase = new GetConversionLogsUseCase(mockGetConversion, mockPubsub)
})

describe('GetConversionLogsUseCase', () => {
  it('deve retornar array vazio quando não há eventos no journal', async () => {
    vi.mocked(mockGetConversion.execute).mockResolvedValue(makeState())
    vi.mocked(mockPubsub.pubLrange).mockResolvedValue([])

    const result = await useCase.execute('conv_test_001', TEST_USER)

    expect(result).toEqual([])
    expect(mockGetConversion.execute).toHaveBeenCalledWith('conv_test_001', TEST_USER)
  })

  it('deve retornar eventos do journal de todos os jobs', async () => {
    vi.mocked(mockGetConversion.execute).mockResolvedValue(
      makeState({
        jobs: [
          { jobId: 'job_001', index: 0, title: 'Vol 01', status: 'completed', progress: 100 },
          { jobId: 'job_002', index: 1, title: 'Vol 02', status: 'completed', progress: 100 },
        ],
        totalJobs: 2,
        completedJobs: 2,
      }),
    )

    vi.mocked(mockPubsub.pubLrange)
      .mockResolvedValueOnce([journalEntries, journalEntries2])
      .mockResolvedValueOnce([journalEntries3])

    const result = await useCase.execute('conv_test_001', TEST_USER)

    expect(result).toHaveLength(3)
    expect(result[0].type).toBe('download.chapter.started')
    expect(result[1].type).toBe('conversion.started')
    expect(result[2].type).toBe('job.finished')
    expect(mockPubsub.pubLrange).toHaveBeenCalledTimes(2)
    expect(mockPubsub.pubLrange).toHaveBeenCalledWith('conversion-journal:job_001', 0, -1)
    expect(mockPubsub.pubLrange).toHaveBeenCalledWith('conversion-journal:job_002', 0, -1)
  })

  it('deve tolerar entradas inválidas no journal (JSON malformado)', async () => {
    vi.mocked(mockGetConversion.execute).mockResolvedValue(makeState())
    vi.mocked(mockPubsub.pubLrange).mockResolvedValue([
      journalEntries,
      'json-invalido',
      journalEntries2,
    ])

    const result = await useCase.execute('conv_test_001', TEST_USER)

    expect(result).toHaveLength(2)
  })

  it('deve lançar ForbiddenError quando userId não corresponde', async () => {
    vi.mocked(mockGetConversion.execute).mockRejectedValue(new ForbiddenError('conv_test_001'))

    await expect(useCase.execute('conv_test_001', OTHER_USER)).rejects.toThrow(ForbiddenError)
  })

  it('deve propagar erros do GetConversionUseCase', async () => {
    vi.mocked(mockGetConversion.execute).mockRejectedValue(
      new ConversionNotFoundError('conv_inexistente'),
    )

    await expect(useCase.execute('conv_inexistente', TEST_USER)).rejects.toThrow(
      ConversionNotFoundError,
    )
  })

  it('deve retornar eventos na ordem correta (primeiro job primeiro)', async () => {
    vi.mocked(mockGetConversion.execute).mockResolvedValue(
      makeState({
        jobs: [
          { jobId: 'job_001', index: 0, title: 'Vol 01', status: 'completed', progress: 100 },
          { jobId: 'job_002', index: 1, title: 'Vol 02', status: 'completed', progress: 100 },
        ],
        totalJobs: 2,
        completedJobs: 2,
      }),
    )

    vi.mocked(mockPubsub.pubLrange)
      .mockResolvedValueOnce([journalEntries])
      .mockResolvedValueOnce([journalEntries2])

    const result = await useCase.execute('conv_test_001', TEST_USER)

    expect(result).toHaveLength(2)
    expect(result[0].id).toBe(1)
    expect(result[1].id).toBe(2)
  })
})
