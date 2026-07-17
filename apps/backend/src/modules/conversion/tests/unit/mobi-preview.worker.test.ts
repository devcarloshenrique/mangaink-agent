import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'
import { processMobiPreviewJob, type MobiPreviewWorkerDeps } from '../../workers/mobi-preview.worker'
import type { MobiPreviewService } from '../../services/mobi-preview.service'
import type { MobiPreviewStatusStore } from '../../../../shared/redis/mobi-preview-status-store'
import type { MobiUnpackRunner, MobiUnpackRunOptions } from '../../services/mobi-unpack-runner.service'
import type { ConversionJobRepository } from '../../repositories/conversion-job.repository'
import type { MobiPreviewIndex, MobiPreviewLiveState } from '../../types/mobi-preview.types'
import { MobiExtractionError } from '../../errors/mobi-preview.errors'

const CONV = 'conv_001'
const JOB = 'job_001'
const FILE = 'Boruto - Vol. 01.mobi'

function makeServiceStub(overrides: Partial<MobiPreviewService> = {}): MobiPreviewService {
  return {
    resolvePaths: vi.fn(() => ({
      mobiPath: `/storage/${CONV}/${JOB}/output/${FILE}`,
      tempDir: `/storage/${CONV}/${JOB}/output/temp/Boruto - Vol. 01`,
      imagesDir: `/storage/${CONV}/${JOB}/output/temp/Boruto - Vol. 01/images`,
      indexPath: `/storage/${CONV}/${JOB}/output/temp/Boruto - Vol. 01/index.json`,
      readyPath: `/storage/${CONV}/${JOB}/output/temp/Boruto - Vol. 01/READY`,
    })),
    isCacheValid: vi.fn(async () => false),
    readIndex: vi.fn(async () => null),
    countReadyPages: vi.fn(async () => 0),
    resolvePageFile: vi.fn(),
    cacheUntil: vi.fn(async () => null),
    requireMobiFile: vi.fn(async () => `/storage/${CONV}/${JOB}/output/${FILE}`),
    clearTemp: vi.fn(),
    ...overrides,
  } as unknown as MobiPreviewService
}

function makeStoreStub(): MobiPreviewStatusStore {
  return {
    set: vi.fn(async () => {}),
    get: vi.fn(async (): Promise<MobiPreviewLiveState | null> => null),
    clear: vi.fn(async () => {}),
  } as unknown as MobiPreviewStatusStore
}

function makeJobRepoStub(outputFile = FILE): ConversionJobRepository {
  return {
    findById: vi.fn(async () => ({
      jobId: JOB,
      status: 'completed',
      progress: 100,
      currentStep: 'Done',
      downloadedImages: 10,
      totalImages: 10,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      outputFile,
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
    })),
    appendLog: vi.fn(async () => {}),
  } as unknown as ConversionJobRepository
}

function makeRunnerStub(): MobiUnpackRunner & { lastOptions: () => unknown } {
  const runner: MobiUnpackRunner & { lastOptions: () => unknown } = {
    run: vi.fn(async (opts: MobiUnpackRunOptions) => {
      ;(runner as unknown as { lastOptions: () => unknown }).lastOptions = () => opts
    }),
    lastOptions: () => undefined,
  } as unknown as MobiUnpackRunner & { lastOptions: () => unknown }
  return runner
}

function makeDeps(overrides: Partial<MobiPreviewWorkerDeps> = {}): MobiPreviewWorkerDeps & { runner: ReturnType<typeof makeRunnerStub> } {
  const runner = makeRunnerStub()
  return {
    service: makeServiceStub(),
    store: makeStoreStub(),
    runner,
    jobs: makeJobRepoStub(),
    ...overrides,
  } as MobiPreviewWorkerDeps & { runner: ReturnType<typeof makeRunnerStub> }
}

describe('processMobiPreviewJob', () => {
  let deps: ReturnType<typeof makeDeps>

  beforeEach(() => {
    deps = makeDeps()
  })

  it('configura status=extracting e chama runner.run com paths corretos', async () => {
    await processMobiPreviewJob(
      { conversionId: CONV, jobId: JOB, outputFile: FILE },
      deps,
    )

    expect(deps.store.set).toHaveBeenCalledWith(JOB, expect.objectContaining({
      status: 'extracting',
      currentStep: expect.stringContaining('Extraindo'),
    }))
    expect(deps.runner.run).toHaveBeenCalledTimes(1)
    const opts = (deps.runner.run as unknown as Mock).mock.calls[0][0] as MobiUnpackRunOptions
    expect(opts.jobId).toBe(JOB)
    expect(opts.mobiPath).toBe(`/storage/${CONV}/${JOB}/output/${FILE}`)
    expect(opts.outputDir).toBe(`/storage/${CONV}/${JOB}/output/temp/Boruto - Vol. 01`)
  })

  it('limpa temp/ antes de extrair', async () => {
    await processMobiPreviewJob(
      { conversionId: CONV, jobId: JOB, outputFile: FILE },
      deps,
    )

    expect(deps.service.clearTemp).toHaveBeenCalledWith(CONV, JOB, FILE)
  })

  it('callback onTick atualiza store com readyPages parciais', async () => {
    const idx: MobiPreviewIndex = {
      sourceMobi: FILE,
      extractedAt: new Date().toISOString(),
      pages: Array.from({ length: 5 }, (_, i) => ({ index: i, filename: `${String(i).padStart(5, '0')}.jpg`, contentType: 'image/jpeg' })),
    }
    deps.service.readIndex = vi.fn(async () => idx)
    deps.service.countReadyPages = vi.fn(async () => 3)

    await processMobiPreviewJob(
      { conversionId: CONV, jobId: JOB, outputFile: FILE },
      deps,
    )

    const opts = (deps.runner.run as unknown as Mock).mock.calls[0][0] as MobiUnpackRunOptions
    await opts.onTick?.()

    expect(deps.store.set).toHaveBeenCalledWith(JOB, expect.objectContaining({
      status: 'extracting',
      totalPages: 5,
      readyPages: 3,
    }))
  })

  it('seta status=ready com totais finais apos termino do runner', async () => {
    const idx: MobiPreviewIndex = {
      sourceMobi: FILE,
      extractedAt: new Date().toISOString(),
      pages: Array.from({ length: 5 }, (_, i) => ({ index: i, filename: `${String(i).padStart(5, '0')}.jpg`, contentType: 'image/jpeg' })),
    }
    deps.service.readIndex = vi.fn(async () => idx)
    deps.service.countReadyPages = vi.fn(async () => 5)

    await processMobiPreviewJob(
      { conversionId: CONV, jobId: JOB, outputFile: FILE },
      deps,
    )

    expect(deps.store.set).toHaveBeenCalledWith(JOB, expect.objectContaining({
      status: 'ready',
      totalPages: 5,
      readyPages: 5,
      completedAt: expect.any(String),
    }))
  })

  it('em caso de erro do runner, seta status=failed com mensagem e relança MobiExtractionError', async () => {
    ;(deps.runner.run as unknown as Mock).mockRejectedValueOnce(new Error('docker daemon offline'))
    await expect(
      processMobiPreviewJob({ conversionId: CONV, jobId: JOB, outputFile: FILE }, deps),
    ).rejects.toBeInstanceOf(MobiExtractionError)

    expect(deps.store.set).toHaveBeenCalledWith(JOB, expect.objectContaining({
      status: 'failed',
      error: expect.stringContaining('docker daemon offline'),
    }))
  })

  it('usa outputPath retornado por service.resolvePaths (conta temp/ base)', async () => {
    await processMobiPreviewJob(
      { conversionId: CONV, jobId: JOB, outputFile: FILE },
      deps,
    )
    const opts = (deps.runner.run as unknown as Mock).mock.calls[0][0] as MobiUnpackRunOptions
    expect(opts.outputDir).toContain('temp')
    expect(opts.outputDir).toContain('Boruto - Vol. 01')
  })

  it('registra log de inicio e conclusao no job repository', async () => {
    const appendLog = vi.fn(async () => {})
    deps.jobs = {
      findById: vi.fn(async () => ({
        jobId: JOB,
        status: 'completed',
        progress: 100,
        currentStep: 'Done',
        downloadedImages: 10,
        totalImages: 10,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        outputFile: FILE,
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
      })),
      appendLog,
    } as unknown as ConversionJobRepository

    await processMobiPreviewJob(
      { conversionId: CONV, jobId: JOB, outputFile: FILE },
      deps,
    )

    expect(appendLog).toHaveBeenCalledWith(JOB, expect.stringContaining('iniciada'))
    expect(appendLog).toHaveBeenCalledWith(JOB, expect.stringContaining('conclu'))
  })
})