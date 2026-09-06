import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { join } from 'node:path'
import { readFile, writeFile } from 'node:fs/promises'
import { processConversionJob } from '../../workers/conversion-job.worker'
import type { ConversionJobData, SSEEvent } from '../../types/conversion.types'

const hoisted = vi.hoisted(() => {
  const testStoragePath = '/tmp/mangaink-test-cover-worker'
  const validJpgBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46])
  const validPngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  return { testStoragePath, validJpgBuffer, validPngBuffer }
})

const { validJpgBuffer, validPngBuffer } = hoisted

const mocked = vi.hoisted(() => {
  const jobRepo = {
    appendLog: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
  }
  const convRepo = {
    syncStatus: vi.fn().mockResolvedValue(undefined),
    findById: vi.fn(),
  }
  const sourceRepo = {
    load: vi.fn(),
    updatePlaceholderIndices: vi.fn(),
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
    getChapterImages: vi.fn().mockResolvedValue(['https://example.com/page1.jpg']),
    downloadImage: vi.fn().mockResolvedValue({ buffer: hoisted.validJpgBuffer }),
  }
  const downloader = {
    downloadChapter: vi.fn().mockResolvedValue({
      downloadedImages: 1,
      errors: 0,
      totalImages: 1,
      corruptPages: [],
      skipped: false,
    }),
  }
  const kccRunner = {
    run: vi.fn().mockResolvedValue({
      outputFile: 'output.epub',
      outputSize: 1024,
    }),
  }

  function reset() {
    jobRepo.appendLog.mockClear()
    jobRepo.update.mockClear()
    convRepo.syncStatus.mockClear()
    convRepo.findById.mockClear()
    sourceRepo.load.mockClear()
    sourceRepo.updatePlaceholderIndices.mockClear()
    events.emitted = []
    store.reset()
    provider.getChapterImages.mockClear().mockResolvedValue(['https://example.com/page1.jpg'])
    provider.downloadImage.mockClear().mockResolvedValue({ buffer: validJpgBuffer })
    downloader.downloadChapter.mockClear().mockResolvedValue({
      downloadedImages: 1,
      errors: 0,
      totalImages: 1,
      corruptPages: [],
      skipped: false,
    })
    kccRunner.run.mockClear().mockResolvedValue({
      outputFile: 'output.epub',
      outputSize: 1024,
    })
  }

  return {
    jobRepo,
    convRepo,
    sourceRepo,
    events,
    store,
    provider,
    downloader,
    kccRunner,
    reset,
  }
})

vi.mock('../../../../shared/config/env', () => ({
  env: {
    STORAGE_PATH: hoisted.testStoragePath,
    CONVERSIONS_STORAGE_PATH: `${hoisted.testStoragePath}/conversions`,
    NODE_ENV: 'test',
    PORT: 3333,
    JWT_SECRET: 'test',
    DATABASE_URL: 'postgres://test',
    REDIS_URL: 'redis://test',
    KCC_DOCKER_IMAGE: 'kcc:test',
  },
}))

vi.mock('../../../../shared/database/repositories', async () => {
  const actual = await vi.importActual<typeof import('../../../../shared/database/repositories')>('../../../../shared/database/repositories')
  return {
    ...actual,
    getSourceRepository: vi.fn(() => mocked.sourceRepo),
    getConversionRepository: vi.fn(() => mocked.convRepo),
    getConversionJobRepository: vi.fn(() => mocked.jobRepo),
  }
})

vi.mock('../../../scraping/utils/resolve-provider', () => ({
  resolveProvider: vi.fn(async () => mocked.provider),
}))

vi.mock('node:fs/promises', async () => {
  const actual = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises')
  return {
    ...actual,
    mkdir: vi.fn().mockResolvedValue(undefined),
    rm: vi.fn().mockResolvedValue(undefined),
    link: vi.fn().mockResolvedValue(undefined),
    readdir: vi.fn().mockResolvedValue(['0001.jpg']),
    rename: vi.fn().mockResolvedValue(undefined),
    stat: vi.fn().mockResolvedValue({ size: 1024 }),
    writeFile: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue(hoisted.validJpgBuffer),
  }
})

vi.mock('../../../../shared/utils/filesystem', () => ({
  mkdirp: vi.fn().mockResolvedValue(undefined),
  pathExists: vi.fn().mockResolvedValue(false),
}))

import { mkdir, writeFile, readFile, readdir } from 'node:fs/promises'
import { pathExists, mkdirp } from '../../../../shared/utils/filesystem'

function makeJobData(overrides: Partial<ConversionJobData> = {}): ConversionJobData {
  return {
    conversionId: 'conv_123',
    jobId: 'job_123',
    bookIndex: 0,
    sourceId: 'src-naruto-123',
    chapters: ['chap_0001'],
    cover: { kind: 'original' },
    output: { deviceId: 'K11', format: 'EPUB' },
    metadata: { title: 'Naruto Vol 1', author: 'Masashi Kishimoto' },
    options: { mangaMode: true },
    storagePath: `${hoisted.testStoragePath}/conversions/conv_123/jobs/job_123`,
    ...overrides,
  }
}

function makeSourceData(overrides: Record<string, any> = {}) {
  return {
    sourceId: 'src-naruto-123',
    status: 'ready',
    chapters: [
      { id: 'chap_0001', number: '1', title: 'Cap 1', url: 'https://example.com/chap1', pages: 10 },
    ],
    covers: [
      { id: 'cover_orig_01', type: 'original', imageUrl: 'https://example.com/orig.jpg' },
    ],
    metadata: {
      title: 'Naruto',
      author: 'Masashi Kishimoto',
      description: null,
      genres: [],
    },
    ...overrides,
  }
}

describe('applyCover in processConversionJob', () => {
  beforeEach(() => {
    mocked.reset()
    mocked.sourceRepo.load.mockResolvedValue(makeSourceData())
    vi.clearAllMocks()
  })

  describe('kind: upload', () => {
    it('deve aplicar capa personalizada quando arquivo existir em uploads/covers', async () => {
      const uploadCoverDir = join(hoisted.testStoragePath, 'uploads', 'covers')
      const customCoverFile = 'upload-cover-uuid-123.jpg'
      const customCoverPath = join(uploadCoverDir, customCoverFile)

      vi.mocked(pathExists).mockImplementation(async (p) => {
        if (p === uploadCoverDir) return true
        if (p === customCoverPath) return true
        return false
      })

      vi.mocked(readdir).mockImplementation(async (p) => {
        if (p === uploadCoverDir) {
          return [customCoverFile] as any
        }
        return ['0001.jpg'] as any
      })

      vi.mocked(readFile).mockImplementation(async (p) => {
        if (p === customCoverPath) {
          return validJpgBuffer
        }
        return validJpgBuffer
      })

      const jobData = makeJobData({
        cover: { kind: 'upload', uploadId: 'upload-cover-uuid-123', name: 'my-custom-cover.jpg' },
      })

      const deps = {
        jobRepository: mocked.jobRepo as any,
        conversions: mocked.convRepo as any,
        sourceRepository: mocked.sourceRepo as any,
        events: mocked.events as any,
        jobLiveStatusStore: mocked.store as any,
        downloader: mocked.downloader as any,
        kccRunner: mocked.kccRunner as any,
      }

      await processConversionJob(jobData, deps)

      const expectedInputCover = join(jobData.storagePath, 'temp', 'input', 'cover.jpg')
      expect(writeFile).toHaveBeenCalledWith(expectedInputCover, validJpgBuffer)
      expect(mocked.jobRepo.appendLog).toHaveBeenCalledWith(
        'job_123',
        expect.stringContaining('Capa personalizada aplicada: my-custom-cover.jpg'),
      )
    })

    it('deve registrar aviso e continuar se arquivo de upload não for encontrado', async () => {
      vi.mocked(readdir).mockResolvedValue([] as any)
      vi.mocked(pathExists).mockResolvedValue(false)

      const jobData = makeJobData({
        cover: { kind: 'upload', uploadId: 'missing-uuid', name: 'missing.jpg' },
      })

      const deps = {
        jobRepository: mocked.jobRepo as any,
        conversions: mocked.convRepo as any,
        sourceRepository: mocked.sourceRepo as any,
        events: mocked.events as any,
        jobLiveStatusStore: mocked.store as any,
        downloader: mocked.downloader as any,
        kccRunner: mocked.kccRunner as any,
      }

      const result = await processConversionJob(jobData, deps)
      expect(result.status).toBe('completed')
      expect(mocked.jobRepo.appendLog).toHaveBeenCalledWith(
        'job_123',
        expect.stringMatching(/não encontrada|não encontrado/i),
      )
    })
  })

  describe('kind: gallery', () => {
    it('deve usar capa do cache quando existir', async () => {
      mocked.sourceRepo.load.mockResolvedValue(makeSourceData({
        covers: [
          { id: 'cover_gallery_01', type: 'volume', imageUrl: 'https://example.com/cover1.jpg' },
          { id: 'cover_gallery_02', type: 'volume', imageUrl: 'https://example.com/cover2.jpg' },
        ],
      }))

      const cachedGalleryPath = join(
        hoisted.testStoragePath,
        'sources',
        'src-naruto-123',
        'covers',
        'cover_gallery_02.jpg',
      )

      vi.mocked(pathExists).mockImplementation(async (p) => {
        if (p === cachedGalleryPath) return true
        return false
      })

      vi.mocked(readFile).mockResolvedValue(validJpgBuffer)

      const jobData = makeJobData({
        cover: { kind: 'gallery', coverId: 'cover_gallery_02' },
      })

      const deps = {
        jobRepository: mocked.jobRepo as any,
        conversions: mocked.convRepo as any,
        sourceRepository: mocked.sourceRepo as any,
        events: mocked.events as any,
        jobLiveStatusStore: mocked.store as any,
        downloader: mocked.downloader as any,
        kccRunner: mocked.kccRunner as any,
      }

      await processConversionJob(jobData, deps)

      const expectedInputCover = join(jobData.storagePath, 'temp', 'input', 'cover.jpg')
      expect(writeFile).toHaveBeenCalledWith(expectedInputCover, validJpgBuffer)
      expect(mocked.jobRepo.appendLog).toHaveBeenCalledWith(
        'job_123',
        expect.stringContaining('Capa da galeria (cover_gallery_02) aplicada'),
      )
    })

    it('deve baixar capa via provider quando não estiver em cache', async () => {
      mocked.sourceRepo.load.mockResolvedValue(makeSourceData({
        covers: [
          { id: 'cover_gallery_01', type: 'volume', imageUrl: 'https://example.com/cover1.png' },
        ],
      }))

      vi.mocked(pathExists).mockResolvedValue(false)
      mocked.provider.downloadImage.mockResolvedValue({ buffer: validPngBuffer })

      const jobData = makeJobData({
        cover: { kind: 'gallery', coverId: 'cover_gallery_01' },
      })

      const deps = {
        jobRepository: mocked.jobRepo as any,
        conversions: mocked.convRepo as any,
        sourceRepository: mocked.sourceRepo as any,
        events: mocked.events as any,
        jobLiveStatusStore: mocked.store as any,
        downloader: mocked.downloader as any,
        kccRunner: mocked.kccRunner as any,
      }

      await processConversionJob(jobData, deps)

      expect(mocked.provider.downloadImage).toHaveBeenCalledWith('https://example.com/cover1.png')
      const expectedInputCover = join(jobData.storagePath, 'temp', 'input', 'cover.png')
      expect(writeFile).toHaveBeenCalledWith(expectedInputCover, validPngBuffer)
      expect(mocked.jobRepo.appendLog).toHaveBeenCalledWith(
        'job_123',
        expect.stringContaining('Capa da galeria (cover_gallery_01) aplicada'),
      )
    })
  })

  describe('kind: original', () => {
    it('deve aplicar capa original existente', async () => {
      mocked.sourceRepo.load.mockResolvedValue(makeSourceData({
        covers: [
          { id: 'cover_orig_01', type: 'original', imageUrl: 'https://example.com/orig.jpg' },
        ],
      }))

      const cachedPath = join(
        hoisted.testStoragePath,
        'sources',
        'src-naruto-123',
        'covers',
        'cover_orig_01.jpg',
      )

      vi.mocked(pathExists).mockImplementation(async (p) => {
        if (p === cachedPath) return true
        return false
      })

      const jobData = makeJobData({
        cover: { kind: 'original' },
      })

      const deps = {
        jobRepository: mocked.jobRepo as any,
        conversions: mocked.convRepo as any,
        sourceRepository: mocked.sourceRepo as any,
        events: mocked.events as any,
        jobLiveStatusStore: mocked.store as any,
        downloader: mocked.downloader as any,
        kccRunner: mocked.kccRunner as any,
      }

      await processConversionJob(jobData, deps)

      const expectedInputCover = join(jobData.storagePath, 'temp', 'input', 'cover.jpg')
      expect(writeFile).toHaveBeenCalledWith(expectedInputCover, validJpgBuffer)
    })
  })

  describe('tratamento de erros em applyCover', () => {
    it('não deve falhar a conversão se ocorrer erro ao baixar ou salvar capa', async () => {
      mocked.sourceRepo.load.mockResolvedValue(makeSourceData({
        covers: [
          { id: 'cover_gallery_01', type: 'volume', imageUrl: 'https://example.com/cover1.jpg' },
        ],
      }))

      vi.mocked(pathExists).mockResolvedValue(false)
      mocked.provider.downloadImage.mockRejectedValue(new Error('Network failure downloading cover'))

      const jobData = makeJobData({
        cover: { kind: 'gallery', coverId: 'cover_gallery_01' },
      })

      const deps = {
        jobRepository: mocked.jobRepo as any,
        conversions: mocked.convRepo as any,
        sourceRepository: mocked.sourceRepo as any,
        events: mocked.events as any,
        jobLiveStatusStore: mocked.store as any,
        downloader: mocked.downloader as any,
        kccRunner: mocked.kccRunner as any,
      }

      const result = await processConversionJob(jobData, deps)
      expect(result.status).toBe('completed')
      expect(mocked.jobRepo.appendLog).toHaveBeenCalledWith(
        'job_123',
        expect.stringContaining('Erro ao aplicar capa'),
      )
    })
  })
})
