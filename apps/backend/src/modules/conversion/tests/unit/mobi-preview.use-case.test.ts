import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'
import {
  StartMobiPreviewUseCase,
  GetMobiPreviewStatusUseCase,
  GetMobiPreviewPageUseCase,
} from '../../use-cases/mobi-preview.use-case'
import {
  ConversionNotFoundError,
  ForbiddenError,
} from '../../errors/conversion.errors'
import {
  NotAMobiJobError,
  InvalidPageIndexError,
  PreviewNotReadyError,
} from '../../errors/mobi-preview.errors'
import type { ConversionRepository } from '../../repositories/conversion.repository'
import type { ConversionJobRepository } from '../../repositories/conversion-job.repository'
import type { MobiPreviewService } from '../../services/mobi-preview.service'
import type { MobiPreviewStatusStore } from '../../../../shared/redis/mobi-preview-status-store'
import type { ConversionState, ConversionJobState } from '../../types/conversion.types'
import type {
  MobiPreviewStartResponse,
  MobiPreviewStatusResponse,
  MobiPreviewLiveState,
} from '../../types/mobi-preview.types'

const TEST_USER = 'user-001'
const OTHER_USER = 'user-999'
const CONV = 'conv_001'
const JOB = 'job_001'
const MOBI_FILE = 'Boruto - Vol. 01.mobi'

interface QueueMock {
  enqueue: Mock
}

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

function makeConv(overrides: Partial<ConversionState> = {}): ConversionState {
  return {
    conversionId: CONV,
    status: 'completed',
    progress: 100,
    totalJobs: 1,
    completedJobs: 1,
    failedJobs: 0,
    runningJobs: 0,
    pendingJobs: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    jobs: [{ jobId: JOB, index: 0, title: 'Vol 1', status: 'completed', progress: 100, outputFile: MOBI_FILE }],
    config: {
      sourceId: 'src-abc',
      cover: { kind: 'original' },
      output: { deviceId: 'kindle_pw5', format: 'MOBI' },
      metadata: { title: 'Test' },
      books: [],
      options: {},
      userId: TEST_USER,
      errorHandlingStrategy: 'ignore',
    },
    ...overrides,
  }
}

function makeJob(overrides: Partial<ConversionJobState> = {}): ConversionJobState {
  return {
    jobId: JOB,
    status: 'completed',
    progress: 100,
    currentStep: 'Done',
    downloadedImages: 30,
    totalImages: 30,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    outputFile: MOBI_FILE,
    config: {
      conversionId: CONV,
      jobId: JOB,
      bookIndex: 0,
      sourceId: 'src-abc',
      chapters: [],
      cover: { kind: 'original' },
      output: { deviceId: 'kindle_pw5', format: 'MOBI' },
      metadata: { title: 'Vol 1' },
      options: {},
      errorHandlingStrategy: 'ignore',
    },
    ...overrides,
  }
}

function makeServiceStub(overrides: Partial<MobiPreviewService> = {}): MobiPreviewService {
  return {
    resolvePaths: vi.fn(),
    isCacheValid: vi.fn(async () => false),
    readIndex: vi.fn(async () => null),
    countReadyPages: vi.fn(async () => 0),
    resolvePageFile: vi.fn(),
    cacheUntil: vi.fn(async () => null),
    requireMobiFile: vi.fn(async () => '/storage/mobi.mobi'),
    clearTemp: vi.fn(),
    ...overrides,
  } as unknown as MobiPreviewService
}

function makeStoreStub(overrides: Partial<MobiPreviewStatusStore> = {}): MobiPreviewStatusStore {
  return {
    set: vi.fn(async () => {}),
    get: vi.fn(async () => null),
    clear: vi.fn(async () => {}),
    ...overrides,
  } as unknown as MobiPreviewStatusStore
}

function makeQueueStub(): QueueMock {
  return { enqueue: vi.fn(async () => ({ id: 'bull-job-1' })) }
}

describe('StartMobiPreviewUseCase', () => {
  let service: MobiPreviewService
  let store: MobiPreviewStatusStore
  let queue: QueueMock

  beforeEach(() => {
    service = makeServiceStub()
    store = makeStoreStub()
    queue = makeQueueStub()
  })

  it('lança ConversionNotFoundError quando conversão não existe', async () => {
    const uc = new StartMobiPreviewUseCase(makeConversionRepo(null), makeJobRepo(null), service, store, queue)
    await expect(uc.execute(CONV, JOB, TEST_USER)).rejects.toBeInstanceOf(ConversionNotFoundError)
  })

  it('lança ForbiddenError quando userId não é o dono', async () => {
    const uc = new StartMobiPreviewUseCase(makeConversionRepo(makeConv()), makeJobRepo(null), service, store, queue)
    await expect(uc.execute(CONV, JOB, OTHER_USER)).rejects.toBeInstanceOf(ForbiddenError)
  })

  it('lança ConversionNotFoundError quando job não existe', async () => {
    const uc = new StartMobiPreviewUseCase(makeConversionRepo(makeConv()), makeJobRepo(null), service, store, queue)
    await expect(uc.execute(CONV, JOB, TEST_USER)).rejects.toBeInstanceOf(ConversionNotFoundError)
  })

  it('lança NotAMobiJobError quando formato de saída não é MOBI nem PDF', async () => {
    const job = makeJob({ outputFile: 'Boruto.epub', config: { ...makeJob().config, output: { deviceId: 'kindle_pw5', format: 'EPUB' } } })
    const uc = new StartMobiPreviewUseCase(makeConversionRepo(makeConv()), makeJobRepo(job), service, store, queue)
    await expect(uc.execute(CONV, JOB, TEST_USER)).rejects.toBeInstanceOf(NotAMobiJobError)
  })

  it('aceita formato de saída PDF e enfileira job para extração', async () => {
    const pdfJob = makeJob({
      outputFile: 'Boruto - Vol. 01.pdf',
      config: { ...makeJob().config, output: { deviceId: 'kindle_pw5', format: 'PDF' } },
    })
    service.isCacheValid = vi.fn(async () => false)
    const uc = new StartMobiPreviewUseCase(makeConversionRepo(makeConv()), makeJobRepo(pdfJob), service, store, queue)
    const result = await uc.execute(CONV, JOB, TEST_USER)
    expect(result).toEqual<MobiPreviewStartResponse>({ status: 'processing', cached: false })
    expect(queue.enqueue).toHaveBeenCalledWith(expect.objectContaining({
      outputFile: 'Boruto - Vol. 01.pdf',
    }))
  })

  it('lança NotAMobiJobError quando job não tem outputFile', async () => {
    const job = makeJob({ outputFile: undefined })
    const uc = new StartMobiPreviewUseCase(makeConversionRepo(makeConv()), makeJobRepo(job), service, store, queue)
    await expect(uc.execute(CONV, JOB, TEST_USER)).rejects.toBeInstanceOf(NotAMobiJobError)
  })

  it('retorna ready com totalPages quando cache é válido', async () => {
    service.isCacheValid = vi.fn(async () => true)
    service.readIndex = vi.fn(async () => ({
      sourceMobi: MOBI_FILE,
      extractedAt: new Date().toISOString(),
      pages: [
        { index: 0, filename: '00000.jpg', contentType: 'image/jpeg' },
        { index: 1, filename: '00001.jpg', contentType: 'image/jpeg' },
      ],
    }))
    const uc = new StartMobiPreviewUseCase(makeConversionRepo(makeConv()), makeJobRepo(makeJob()), service, store, queue)
    const result = await uc.execute(CONV, JOB, TEST_USER)
    expect(result).toEqual<MobiPreviewStartResponse>({ status: 'ready', totalPages: 2, cached: true })
    expect(queue.enqueue).not.toHaveBeenCalled()
  })

  it('enfileira job no BullMQ e marca status=queued quando cache inválido', async () => {
    service.isCacheValid = vi.fn(async () => false)
    const uc = new StartMobiPreviewUseCase(makeConversionRepo(makeConv()), makeJobRepo(makeJob()), service, store, queue)
    const result = await uc.execute(CONV, JOB, TEST_USER)
    expect(result).toEqual<MobiPreviewStartResponse>({ status: 'processing', cached: false })
    expect(queue.enqueue).toHaveBeenCalledTimes(1)
    expect(queue.enqueue).toHaveBeenCalledWith(expect.objectContaining({
      conversionId: CONV,
      jobId: JOB,
      outputFile: MOBI_FILE,
    }))
    expect(store.set).toHaveBeenCalledWith(JOB, expect.objectContaining({ status: 'queued' }))
  })

  it('é idempotente: se já existe job "extracting" no store, não reenfileira', async () => {
    service.isCacheValid = vi.fn(async () => false)
    store.get = vi.fn(async (): Promise<MobiPreviewLiveState | null> => ({ status: 'extracting', totalPages: 10, readyPages: 3, currentStep: 'extraindo', updatedAt: new Date().toISOString() }))
    const uc = new StartMobiPreviewUseCase(makeConversionRepo(makeConv()), makeJobRepo(makeJob()), service, store, queue)
    const result = await uc.execute(CONV, JOB, TEST_USER)
    expect(result).toEqual<MobiPreviewStartResponse>({ status: 'processing', cached: false })
    expect(queue.enqueue).not.toHaveBeenCalled()
  })
})

describe('GetMobiPreviewStatusUseCase', () => {
  let service: MobiPreviewService
  let store: MobiPreviewStatusStore

  beforeEach(() => {
    service = makeServiceStub()
    store = makeStoreStub()
  })

  it('lança ForbiddenError quando userId não é o dono', async () => {
    const uc = new GetMobiPreviewStatusUseCase(makeConversionRepo(makeConv()), makeJobRepo(null), service, store)
    await expect(uc.execute(CONV, JOB, OTHER_USER)).rejects.toBeInstanceOf(ForbiddenError)
  })

  it('lança NotAMobiJobError se o job não é MOBI nem PDF', async () => {
    const job = makeJob({ outputFile: 'Boruto.cbz', config: { ...makeJob().config, output: { deviceId: 'kindle_pw5', format: 'CBZ' } } })
    const uc = new GetMobiPreviewStatusUseCase(makeConversionRepo(makeConv()), makeJobRepo(job), service, store)
    await expect(uc.execute(CONV, JOB, TEST_USER)).rejects.toBeInstanceOf(NotAMobiJobError)
  })

  it('aceita job em formato PDF no status preview', async () => {
    const pdfJob = makeJob({ outputFile: 'Boruto.pdf', config: { ...makeJob().config, output: { deviceId: 'kindle_pw5', format: 'PDF' } } })
    store.get = vi.fn(async (): Promise<MobiPreviewLiveState | null> => ({ status: 'ready', totalPages: 5, readyPages: 5, currentStep: 'Done', completedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }))
    service.countReadyPages = vi.fn(async () => 5)
    service.readIndex = vi.fn(async () => ({ sourceMobi: 'Boruto.pdf', extractedAt: new Date().toISOString(), pages: Array.from({ length: 5 }, (_, i) => ({ index: i, filename: `${i}.png`, contentType: 'image/png' })) }))
    service.cacheUntil = vi.fn(async () => '2099-01-01T00:00:00.000Z')
    const uc = new GetMobiPreviewStatusUseCase(makeConversionRepo(makeConv()), makeJobRepo(pdfJob), service, store)
    const status = await uc.execute(CONV, JOB, TEST_USER)
    expect(status?.status).toBe('ready')
    expect(status?.totalPages).toBe(5)
  })

  it('retorna ready com cacheUntil e totais quando job concluído', async () => {
    store.get = vi.fn(async (): Promise<MobiPreviewLiveState | null> => ({ status: 'ready', totalPages: 5, readyPages: 5, currentStep: 'Done', completedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }))
    service.countReadyPages = vi.fn(async () => 5)
    service.readIndex = vi.fn(async () => ({ sourceMobi: MOBI_FILE, extractedAt: new Date().toISOString(), pages: Array.from({ length: 5 }, (_, i) => ({ index: i, filename: `${i}.jpg`, contentType: 'image/jpeg' })) }))
    service.cacheUntil = vi.fn(async () => '2099-01-01T00:00:00.000Z')
    const uc = new GetMobiPreviewStatusUseCase(makeConversionRepo(makeConv()), makeJobRepo(makeJob()), service, store)
    const status = await uc.execute(CONV, JOB, TEST_USER)
    expect<MobiPreviewStatusResponse | null>(status).toEqual({
      status: 'ready',
      totalPages: 5,
      readyPages: 5,
      cacheUntil: '2099-01-01T00:00:00.000Z',
    })
  })

  it('retorna extracting com readyPages parciais quando job em curso', async () => {
    store.get = vi.fn(async (): Promise<MobiPreviewLiveState | null> => ({ status: 'extracting', totalPages: 10, readyPages: 3, currentStep: 'Extraindo', updatedAt: new Date().toISOString() }))
    service.countReadyPages = vi.fn(async () => 3)
    service.readIndex = vi.fn(async () => null)
    service.cacheUntil = vi.fn(async () => null)
    const uc = new GetMobiPreviewStatusUseCase(makeConversionRepo(makeConv()), makeJobRepo(makeJob()), service, store)
    const status = await uc.execute(CONV, JOB, TEST_USER)
    expect(status!.status).toBe('extracting')
    expect(status!.readyPages).toBe(3)
    expect(status!.totalPages).toBe(10)
    expect(status!.cacheUntil).toBeNull()
  })

  it('retorna failed com erro quando store marca erro', async () => {
    store.get = vi.fn(async (): Promise<MobiPreviewLiveState | null> => ({ status: 'failed', totalPages: 0, readyPages: 0, currentStep: '', error: 'docker not found', updatedAt: new Date().toISOString() }))
    const uc = new GetMobiPreviewStatusUseCase(makeConversionRepo(makeConv()), makeJobRepo(makeJob()), service, store)
    const status = await uc.execute(CONV, JOB, TEST_USER)
    expect(status!.status).toBe('failed')
    expect(status!.error).toBe('docker not found')
  })

  it('retorna queued inicial quando nenhum estado no store', async () => {
    store.get = vi.fn(async () => null)
    const uc = new GetMobiPreviewStatusUseCase(makeConversionRepo(makeConv()), makeJobRepo(makeJob()), service, store)
    const status = await uc.execute(CONV, JOB, TEST_USER)
    expect(status!.status).toBe('queued')
    expect(status!.totalPages).toBe(0)
    expect(status!.readyPages).toBe(0)
  })
})

describe('GetMobiPreviewPageUseCase', () => {
  let service: MobiPreviewService
  let store: MobiPreviewStatusStore

  beforeEach(() => {
    service = makeServiceStub()
    store = makeStoreStub()
  })

  it('lança ForbiddenError quando userId não é o dono', async () => {
    const uc = new GetMobiPreviewPageUseCase(makeConversionRepo(makeConv()), makeJobRepo(null), service)
    await expect(uc.execute(CONV, JOB, OTHER_USER, 0)).rejects.toBeInstanceOf(ForbiddenError)
  })

  it('lança NotAMobiJobError quando o formato não é MOBI nem PDF', async () => {
    const job = makeJob({ outputFile: 'Boruto.epub', config: { ...makeJob().config, output: { deviceId: 'kindle_pw5', format: 'EPUB' } } })
    const uc = new GetMobiPreviewPageUseCase(makeConversionRepo(makeConv()), makeJobRepo(job), service)
    await expect(uc.execute(CONV, JOB, TEST_USER, 0)).rejects.toBeInstanceOf(NotAMobiJobError)
  })

  it('permite buscar página quando formato é PDF', async () => {
    const pdfJob = makeJob({ outputFile: 'Boruto.pdf', config: { ...makeJob().config, output: { deviceId: 'kindle_pw5', format: 'PDF' } } })
    service.resolvePageFile = vi.fn(async () => ({ filePath: '/temp/images/00000.png', contentType: 'image/png' }))
    const uc = new GetMobiPreviewPageUseCase(makeConversionRepo(makeConv()), makeJobRepo(pdfJob), service)
    const r = await uc.execute(CONV, JOB, TEST_USER, 0)
    expect(r).toEqual({ filePath: '/temp/images/00000.png', contentType: 'image/png' })
  })

  it('retorna { filePath, contentType } quando pagina existe', async () => {
    service.resolvePageFile = vi.fn(async () => ({ filePath: '/temp/images/00000.jpg', contentType: 'image/jpeg' }))
    const uc = new GetMobiPreviewPageUseCase(makeConversionRepo(makeConv()), makeJobRepo(makeJob()), service)
    const r = await uc.execute(CONV, JOB, TEST_USER, 0)
    expect(r).toEqual({ filePath: '/temp/images/00000.jpg', contentType: 'image/jpeg' })
  })

  it('repassa InvalidPageIndexError do service', async () => {
    service.resolvePageFile = vi.fn(async () => { throw new InvalidPageIndexError(JOB, 99, 5) })
    const uc = new GetMobiPreviewPageUseCase(makeConversionRepo(makeConv()), makeJobRepo(makeJob()), service)
    await expect(uc.execute(CONV, JOB, TEST_USER, 99)).rejects.toBeInstanceOf(InvalidPageIndexError)
  })

  it('repassa PreviewNotReadyError do service', async () => {
    service.resolvePageFile = vi.fn(async () => { throw new PreviewNotReadyError(JOB, 0, 0) })
    const uc = new GetMobiPreviewPageUseCase(makeConversionRepo(makeConv()), makeJobRepo(makeJob()), service)
    await expect(uc.execute(CONV, JOB, TEST_USER, 0)).rejects.toBeInstanceOf(PreviewNotReadyError)
  })
})