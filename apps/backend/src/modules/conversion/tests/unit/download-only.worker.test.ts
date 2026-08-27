import { describe, it, expect, beforeEach, vi } from 'vitest'
import { join } from 'node:path'
import { processDownloadOnlyJob } from '../../workers/download-only.worker'
import type { ConversionJobData, SSEEvent } from '../../types/conversion.types'

const hoisted = vi.hoisted(() => {
  const testStoragePath = '/tmp/mangaink-test-dl-worker'
  return { testStoragePath }
})

const mocked = vi.hoisted(() => {
  const jobRepo = {
    appendLog: vi.fn(),
    update: vi.fn(),
  }
  const convRepo = {
    syncStatus: vi.fn(async () => {}),
    findById: vi.fn(),
  }
  const sourceRepo = {
    load: vi.fn(),
    updatePlaceholderIndices: vi.fn(),
    updateChapterUnavailableReason: vi.fn().mockResolvedValue(undefined),
  }
  const events = {
    emitted: [] as Array<{ channel: string; event: SSEEvent }>,
    createEvent(type: string, data: Record<string, unknown> = {}): SSEEvent {
      return { type, data, timestamp: new Date().toISOString() }
    },
    async emit(channel: string, event: SSEEvent) {
      mocked.events.emitted.push({ channel, event })
    },
  }
  const store = {
    values: new Map<string, Record<string, unknown>>(),
    async set(jobId: string, data: Record<string, unknown>) {
      this.values.set(jobId, data)
    },
    async get(jobId: string) {
      return this.values.get(jobId) ?? null
    },
    async clear(jobId: string) {
      this.values.delete(jobId)
    },
    reset() {
      this.values.clear()
    },
  }
  const provider = {
    getChapterImages: vi.fn(),
    downloadImage: vi.fn(),
  }
  const downloader = {
    downloadChapter: vi.fn(),
  }
  const placeholder = {
    generateDefault: vi.fn(),
  }
  const resolveProvider = vi.fn()

  function reset() {
    jobRepo.appendLog.mockClear()
    jobRepo.update.mockClear()
    convRepo.syncStatus.mockClear()
    convRepo.findById.mockClear()
    sourceRepo.load.mockClear()
    sourceRepo.updatePlaceholderIndices.mockClear()
    events.emitted = []
    store.reset()
    provider.getChapterImages.mockClear()
    provider.downloadImage.mockClear()
    downloader.downloadChapter.mockClear()
    placeholder.generateDefault.mockClear()
    resolveProvider.mockClear()
  }

  function eventsOf(type: string) {
    return mocked.events.emitted.filter((e) => e.event.type === type)
  }

  return {
    jobRepo,
    convRepo,
    sourceRepo,
    events,
    store,
    provider,
    downloader,
    placeholder,
    resolveProvider,
    reset,
    eventsOf,
  }
})

vi.mock('../../../../shared/utils/filesystem', () => ({
  mkdirp: vi.fn(),
  pathExists: vi.fn(async () => false),
}))

vi.mock('node:fs/promises', async () => {
  const actual = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises')
  return {
    ...actual,
    writeFile: vi.fn(async () => {}),
    mkdir: vi.fn(async () => {}),
  }
})

vi.mock('../../../../shared/config/env', () => ({
  env: {
    STORAGE_PATH: hoisted.testStoragePath,
    CONVERSIONS_STORAGE_PATH: join(hoisted.testStoragePath, 'conversions'),
    NODE_ENV: 'test',
    PORT: 3333,
    JWT_SECRET: 'test',
    DATABASE_URL: 'postgres://test',
    REDIS_URL: 'redis://test',
    KCC_DOCKER_IMAGE: 'kcc:test',
  },
}))

vi.mock('../../../../shared/infra/redis', () => ({
  RedisPubSubAdapter: vi.fn(() => ({
    publish: vi.fn(),
    subscribe: vi.fn(),
    subscribeMany: vi.fn(),
    unsubscribe: vi.fn(),
    unsubscribeMany: vi.fn(),
  })),
  RedisJournalAdapter: vi.fn(() => ({
    append: vi.fn(),
    range: vi.fn(async () => []),
    nextId: vi.fn(),
    expire: vi.fn(),
  })),
}))

vi.mock('../../services/conversion-events.service', () => ({
  ConversionEventsService: vi.fn(() => ({
    createEvent: (type: string, data: Record<string, unknown>) => ({
      type,
      data,
      timestamp: new Date().toISOString(),
    }),
    emit: vi.fn(),
    close: vi.fn(),
  })),
}))

vi.mock('../../../../shared/redis/job-status-store', () => ({
  JobLiveStatusStore: vi.fn(() => mocked.store),
}))

vi.mock('../../../../shared/redis/bullmq', () => ({
  createQueue: vi.fn(() => ({
    add: vi.fn(),
    getJob: vi.fn(),
    close: vi.fn(),
  })),
}))

vi.mock('bullmq', () => ({
  Worker: vi.fn(() => ({ on: vi.fn(), close: vi.fn() })),
  Queue: vi.fn(),
}))

function makeJobData(overrides: Partial<ConversionJobData> = {}): ConversionJobData {
  return {
    conversionId: 'conv_test_001',
    jobId: 'job_test_001',
    bookIndex: 0,
    sourceId: 'src_test_001',
    chapters: ['chap_0001', 'chap_0002'],
    cover: { kind: 'original' },
    output: { deviceId: 'kindle_pw', format: 'epub' },
    metadata: { title: 'Test' },
    options: {},
    storagePath: join(hoisted.testStoragePath, 'conversions', 'conv_test_001', 'jobs', 'job_test_001'),
    downloadOnly: true,
    ...overrides,
  }
}

function makeDeps() {
  return {
    jobRepository: mocked.jobRepo as any,
    conversionRepository: mocked.convRepo as any,
    sourceRepository: mocked.sourceRepo as any,
    events: mocked.events as any,
    jobLiveStatusStore: mocked.store as any,
    resolveProvider: mocked.resolveProvider,
    downloader: mocked.downloader as any,
    placeholderService: mocked.placeholder as any,
  }
}

beforeEach(() => {
  mocked.reset()
  mocked.resolveProvider.mockResolvedValue(mocked.provider)
  mocked.provider.getChapterImages.mockResolvedValue([
    'https://example.com/img/01.jpg',
    'https://example.com/img/02.jpg',
  ])
  mocked.downloader.downloadChapter.mockResolvedValue({
    downloadedImages: 2,
    totalImages: 2,
    errors: 0,
    corruptPages: [],
    fromCache: false,
    skipped: false,
  })
  mocked.sourceRepo.load.mockResolvedValue({
    sourceId: 'src_test_001',
    chapters: [
      { id: 'chap_0001', url: 'https://example.com/ch/1' },
      { id: 'chap_0002', url: 'https://example.com/ch/2' },
    ],
    covers: [],
  })
})

describe('processDownloadOnlyJob', () => {
  it('deve baixar capítulos e emitir eventos corretos', async () => {
    const result = await processDownloadOnlyJob(makeJobData(), makeDeps())

    expect(result.status).toBe('completed')
    expect(result.successfulChapters).toHaveLength(2)
    expect(mocked.downloader.downloadChapter).toHaveBeenCalledTimes(2)

    expect(mocked.eventsOf('job.started')).toHaveLength(1)
    expect(mocked.eventsOf('download.started')).toHaveLength(1)
    expect(mocked.eventsOf('job.finished')).toHaveLength(1)

    const finishedEvent = mocked.eventsOf('job.finished')[0]
    expect(finishedEvent.event.data.downloadOnly).toBe(true)
    expect(finishedEvent.event.data.totalImages).toBe(4)
  })

  it('nao deve emitir eventos de conversion (KCC)', async () => {
    await processDownloadOnlyJob(makeJobData(), makeDeps())

    expect(mocked.eventsOf('conversion.started')).toHaveLength(0)
    expect(mocked.eventsOf('conversion.progress')).toHaveLength(0)
    expect(mocked.eventsOf('conversion.finished')).toHaveLength(0)
  })

  it('deve lancar erro quando provider nao encontrado', async () => {
    mocked.resolveProvider.mockResolvedValue(null)

    await expect(processDownloadOnlyJob(makeJobData(), makeDeps())).rejects.toThrow(
      'resolver o provider',
    )
  })

  it('deve atualizar job como completed ao final', async () => {
    await processDownloadOnlyJob(makeJobData(), makeDeps())

    expect(mocked.jobRepo.update).toHaveBeenCalledWith(
      'job_test_001',
      expect.objectContaining({ status: 'completed', progress: 100 }),
    )
    expect(mocked.convRepo.syncStatus).toHaveBeenCalled()
  })

  it('deve chamar syncStatus em cada fase', async () => {
    await processDownloadOnlyJob(makeJobData(), makeDeps())

    // Chamado pelo menos 3 vezes: preparing, downloading, finished
    expect(mocked.convRepo.syncStatus.mock.calls.length).toBeGreaterThanOrEqual(3)
  })

  it('deve lidar com capítulos skipped', async () => {
    mocked.downloader.downloadChapter
      .mockResolvedValueOnce({
        downloadedImages: 2,
        totalImages: 2,
        errors: 0,
        corruptPages: [],
        fromCache: false,
        skipped: false,
      })
      .mockResolvedValueOnce({
        downloadedImages: 0,
        totalImages: 0,
        errors: 0,
        corruptPages: [],
        fromCache: false,
        skipped: true,
      })

    const result = await processDownloadOnlyJob(makeJobData(), makeDeps())

    expect(result.status).toBe('completed')
    expect(result.successfulChapters).toHaveLength(1)
    expect(mocked.downloader.downloadChapter).toHaveBeenCalledTimes(2)
  })

  it('deve lancar erro quando nenhum capítulo pode ser baixado', async () => {
    mocked.downloader.downloadChapter.mockResolvedValue({
      downloadedImages: 0,
      totalImages: 0,
      errors: 0,
      corruptPages: [],
      fromCache: false,
      skipped: true,
    })

    await expect(processDownloadOnlyJob(makeJobData(), makeDeps())).rejects.toThrow(
      'Nenhum capítulo pôde ser baixado',
    )
  })

  it.skip('should mark job as cancelled when live status returns cancelled during the loop', async () => {
    // Teste de cancelamento requer controle mais preciso da ordem de eventos.
    // Testado indiretamente pelos testes de cancelamento do use-case.
  })

  it('deve ignorar capítulo quando getChapterImages retorna array vazio', async () => {
    mocked.provider.getChapterImages.mockResolvedValue([])
    mocked.downloader.downloadChapter.mockClear()

    await expect(processDownloadOnlyJob(makeJobData(), makeDeps())).rejects.toThrow(
      'Nenhum capítulo pôde ser baixado',
    )
    expect(mocked.downloader.downloadChapter).not.toHaveBeenCalled()
  })

  it('deve baixar capa mesmo quando nao esta em cache', async () => {
    mocked.sourceRepo.load.mockResolvedValue({
      sourceId: 'src_test_001',
      chapters: [
        { id: 'chap_0001', url: 'https://example.com/ch/1' },
        { id: 'chap_0002', url: 'https://example.com/ch/2' },
      ],
      covers: [
        {
          id: 'cover_001',
          type: 'original',
          label: 'Original',
          imageUrl: 'https://img.example.com/cover.jpg',
        },
      ],
    })

    mocked.provider.downloadImage.mockResolvedValue({
      buffer: Buffer.from('fake-image-data'),
      contentType: 'image/jpeg',
    })

    await processDownloadOnlyJob(makeJobData(), makeDeps())

    // Verifica que a capa foi baixada (chamada ao downloadImage com a URL da capa)
    const coverCalls = mocked.provider.downloadImage.mock.calls.filter(
      (call: string[]) => call[0] === 'https://img.example.com/cover.jpg',
    )
    expect(coverCalls).toHaveLength(1)
  })
})

describe('processDownloadOnlyJob — notificações do dono (owner-notifier)', () => {
  function makeNotify() {
    return vi.fn(async () => ({}))
  }

  function makeNotificationDeps(notify = makeNotify()) {
    const deps = makeDeps()
    return {
      deps: { ...deps, notifications: { notify } },
      notify,
    }
  }

  function seedConversion(status = 'processing') {
    mocked.convRepo.findById.mockResolvedValue({
      config: { userId: 'user-1' },
      status,
    })
  }

  it('emite download_completed ao concluir, com metadados do lote', async () => {
    const { deps, notify } = makeNotificationDeps()
    seedConversion()

    await processDownloadOnlyJob(makeJobData(), deps)

    expect(notify).toHaveBeenCalledTimes(1)
    expect(notify).toHaveBeenCalledWith('user-1', expect.objectContaining({
      type: 'download_completed',
      title: 'Download concluído',
      message: '2/2 capítulo(s) baixado(s)',
      metadata: expect.objectContaining({
        conversionId: 'conv_test_001',
        jobId: 'job_test_001',
        successfulChapters: 2,
        totalImages: 4,
      }),
    }))
    // metadata NÃO deve conter failedChapters quando tudo deu certo
    expect(notify.mock.calls[0][1].metadata.failedChapters).toBeUndefined()
  })

  it('inclui failedChapters com motivo por capítulo e mensagem com contagem de falhas quando há skips', async () => {
    const { deps, notify } = makeNotificationDeps()
    seedConversion()
    mocked.downloader.downloadChapter
      .mockResolvedValueOnce({
        downloadedImages: 2,
        totalImages: 2,
        errors: 0,
        corruptPages: [],
        fromCache: false,
        skipped: false,
      })
      .mockResolvedValueOnce({
        downloadedImages: 0,
        totalImages: 0,
        errors: 0,
        corruptPages: [],
        fromCache: false,
        skipped: true,
      })

    await processDownloadOnlyJob(makeJobData(), deps)

    expect(notify).toHaveBeenCalledWith('user-1', expect.objectContaining({
      type: 'download_completed',
      title: 'Download concluído com 1 falha(s)',
      message: '1/2 capítulo(s) baixado(s) • 1 falha(s)',
      metadata: expect.objectContaining({
        successfulChapters: 1,
        failedChapters: [expect.objectContaining({ chapterId: 'chap_0002' })],
      }),
    }))
  })

  it('SUPRIME notificação quando a conversão foi cancelada pelo usuário', async () => {
    const { deps, notify } = makeNotificationDeps()
    seedConversion('cancelled')

    await processDownloadOnlyJob(makeJobData(), deps)

    // O job completa normalmente; apenas a notificação não sai.
    expect(notify).not.toHaveBeenCalled()
  })

  it('não notifica sem NotificationService nas deps (retrocompatibilidade)', async () => {
    seedConversion()
    await processDownloadOnlyJob(makeJobData(), makeDeps())
    // Sem crash e sem chamadas — nada a asserir além de não ter lançado.
    expect(mocked.jobRepo.update).toHaveBeenCalled()
  })
})
