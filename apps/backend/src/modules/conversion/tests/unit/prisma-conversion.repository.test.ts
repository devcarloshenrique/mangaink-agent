import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { prisma } from '../../../../shared/database/prisma'
import { PrismaConversionRepository } from '../../repositories/prisma-conversion.repository'
import { PrismaJobRepository } from '../../repositories/prisma-job.repository'
import type { ConversionState, ConversionConfig, ConversionJobState } from '../../types/conversion.types'

let seq = 0
function nextId(prefix: string): string {
  return `${prefix}-${Date.now()}-${++seq}`
}

function makeConfig(userId: string): ConversionConfig {
  return {
    sourceId: nextId('src-test-conv'),
    cover: { kind: 'original' },
    output: { deviceId: 'kindle_pw5', format: 'EPUB' },
    metadata: { title: 'Test Manga', author: 'Test Author' },
    books: [
      { title: 'Vol 1', chapters: ['ch_001', 'ch_002'] },
      { title: 'Vol 2', chapters: ['ch_003'] },
    ],
    options: { spreadSplit: true },
    errorHandlingStrategy: 'ignore',
    userId,
  }
}

function makeConversionState(config: ConversionConfig, convId: string, overrides?: Partial<ConversionState>): ConversionState {
  return {
    conversionId: convId,
    status: 'queued',
    progress: 0,
    totalJobs: config.books.length,
    completedJobs: 0,
    failedJobs: 0,
    runningJobs: 0,
    pendingJobs: config.books.length,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    jobs: config.books.map((b, i) => ({
      jobId: `job_${convId}_${String(i + 1).padStart(3, '0')}`,
      index: i,
      title: b.title,
      status: 'queued' as const,
      progress: 0,
    })),
    config,
    ...overrides,
  }
}

function makeJobState(jobId: string, convId: string, index: number, config: ConversionConfig, bookIndex: number): ConversionJobState {
  const book = config.books[bookIndex]
  return {
    jobId,
    status: 'queued',
    progress: 0,
    currentStep: 'Queued',
    downloadedImages: 0,
    totalImages: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    config: {
      conversionId: convId,
      jobId,
      bookIndex,
      sourceId: config.sourceId,
      chapters: book.chapters,
      cover: config.cover,
      output: config.output,
      metadata: { title: book.title, author: config.metadata.author },
      options: config.options,
      errorHandlingStrategy: config.errorHandlingStrategy,
    },
  }
}

const USER_ID = '00000000-0000-0000-0000-000000000001'

describe('PrismaConversionRepository', () => {
  const repo = new PrismaConversionRepository()

  beforeAll(async () => {
    await prisma.user.upsert({
      where: { id: USER_ID },
      create: { id: USER_ID, username: 'testuser_conv', email: 'test-conv@test.com', passwordHash: 'hashed' },
      update: {},
    })
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  describe('create + findById', () => {
    it('deve criar Conversion e retornar via findById', async () => {
      const convId = nextId('conv-create')
      const config = makeConfig(USER_ID)
      await repo.create(makeConversionState(config, convId))

      const found = await repo.findById(convId)
      expect(found).not.toBeNull()
      expect(found!.conversionId).toBe(convId)
      expect(found!.status).toBe('queued')
      expect(found!.totalJobs).toBe(2)
      expect(found!.config.userId).toBe(USER_ID)
    })

    it('findById retorna null para conversion inexistente', async () => {
      const found = await repo.findById('conv-nonexistent')
      expect(found).toBeNull()
    })
  })

  describe('update', () => {
    it('deve atualizar campos de status sem alterar config', async () => {
      const convId = nextId('conv-update')
      const config = makeConfig(USER_ID)
      await repo.create(makeConversionState(config, convId))
      await repo.update(convId, { status: 'processing', progress: 50 })

      const found = await repo.findById(convId)
      expect(found!.status).toBe('processing')
      expect(found!.progress).toBe(50)
    })
  })

  describe('syncStatus', () => {
    it('deve computar processing quando ha jobs ativos', async () => {
      const convId = nextId('conv-sync')
      const config = makeConfig(USER_ID)
      await repo.create(makeConversionState(config, convId))

      const jobRepo = new PrismaJobRepository().withConversion(convId)
      await jobRepo.create(makeJobState(`job_${convId}_001`, convId, 0, config, 0))
      await jobRepo.create(makeJobState(`job_${convId}_002`, convId, 1, config, 1))
      await jobRepo.update(`job_${convId}_001`, { status: 'downloading', progress: 40 })
      await jobRepo.update(`job_${convId}_002`, { status: 'queued', progress: 0 })

      const synced = await repo.syncStatus(convId)
      expect(synced!.status).toBe('processing')
      expect(synced!.runningJobs).toBe(1)
      expect(synced!.pendingJobs).toBe(1)
      expect(synced!.progress).toBe(20)
    })

    it('deve computar completed quando todos jobs finalizaram', async () => {
      const convId = nextId('conv-comp')
      const config = makeConfig(USER_ID)
      await repo.create(makeConversionState(config, convId))

      const jobRepo = new PrismaJobRepository().withConversion(convId)
      await jobRepo.create(makeJobState(`job_${convId}_001`, convId, 0, config, 0))
      await jobRepo.create(makeJobState(`job_${convId}_002`, convId, 1, config, 1))
      await jobRepo.update(`job_${convId}_001`, { status: 'completed', progress: 100, outputFile: 'test.epub', outputSize: 1024 })
      await jobRepo.update(`job_${convId}_002`, { status: 'completed', progress: 100, outputFile: 'test2.epub', outputSize: 2048 })

      const synced = await repo.syncStatus(convId)
      expect(synced!.status).toBe('completed')
      expect(synced!.completedJobs).toBe(2)
      expect(synced!.progress).toBe(100)
    })

    it('deve computar partial com mix de completed e failed', async () => {
      const convId = nextId('conv-part')
      const config = makeConfig(USER_ID)
      await repo.create(makeConversionState(config, convId, { totalJobs: 3, pendingJobs: 3 }))

      const conv = await prisma.conversion.findUnique({ where: { conversionId: convId } })
      await prisma.conversionJob.createMany({
        data: [
          { jobId: `job_${convId}_001`, conversionId: conv!.id, sourceId: config.sourceId, bookIndex: 0, chapters: [], cover: {} as any, output: {} as any, metadata: { title: 'Vol 1' } as any, options: {} as any, status: 'completed', progress: 100, currentStep: 'Done', downloadedImages: 0, totalImages: 0 },
          { jobId: `job_${convId}_002`, conversionId: conv!.id, sourceId: config.sourceId, bookIndex: 1, chapters: [], cover: {} as any, output: {} as any, metadata: { title: 'Vol 2' } as any, options: {} as any, status: 'completed', progress: 100, currentStep: 'Done', downloadedImages: 0, totalImages: 0 },
          { jobId: `job_${convId}_003`, conversionId: conv!.id, sourceId: config.sourceId, bookIndex: 2, chapters: [], cover: {} as any, output: {} as any, metadata: { title: 'Vol 3' } as any, options: {} as any, status: 'failed', progress: 0, currentStep: 'Failed', downloadedImages: 0, totalImages: 0 },
        ],
      })

      const synced = await repo.syncStatus(convId)
      expect(synced!.status).toBe('partial')
      expect(synced!.completedJobs).toBe(2)
      expect(synced!.failedJobs).toBe(1)
    })
  })

  describe('listJobIds', () => {
    it('deve listar jobIds da conversion', async () => {
      const convId = nextId('conv-list')
      const config = makeConfig(USER_ID)
      await repo.create(makeConversionState(config, convId))

      const conv = await prisma.conversion.findUnique({ where: { conversionId: convId } })
      await prisma.conversionJob.createMany({
        data: [
          { jobId: `job_${convId}_001`, conversionId: conv!.id, sourceId: config.sourceId, bookIndex: 0, chapters: [], cover: {} as any, output: {} as any, metadata: {} as any, options: {} as any, status: 'queued', progress: 0, currentStep: '', downloadedImages: 0, totalImages: 0 },
          { jobId: `job_${convId}_002`, conversionId: conv!.id, sourceId: config.sourceId, bookIndex: 1, chapters: [], cover: {} as any, output: {} as any, metadata: {} as any, options: {} as any, status: 'queued', progress: 0, currentStep: '', downloadedImages: 0, totalImages: 0 },
        ],
      })

      const ids = await repo.listJobIds(convId)
      expect(ids).toHaveLength(2)
    })

    it('deve retornar array vazio para conversion sem jobs', async () => {
      const ids = await repo.listJobIds('conv-nonexistent')
      expect(ids).toEqual([])
    })
  })

  describe('delete', () => {
    it('deve remover conversion e jobs em cascade', async () => {
      const convId = nextId('conv-del')
      const config = makeConfig(USER_ID)
      await repo.create(makeConversionState(config, convId))

      const conv = await prisma.conversion.findUnique({ where: { conversionId: convId } })
      await prisma.conversionJob.create({
        data: { jobId: `job_${convId}_001`, conversionId: conv!.id, sourceId: config.sourceId, bookIndex: 0, chapters: [], cover: {} as any, output: {} as any, metadata: {} as any, options: {} as any, status: 'queued', progress: 0, currentStep: '', downloadedImages: 0, totalImages: 0 },
      })

      await repo.delete(convId)

      const found = await repo.findById(convId)
      expect(found).toBeNull()

      const jobsCount = await prisma.conversionJob.count({ where: { jobId: `job_${convId}_001` } })
      expect(jobsCount).toBe(0)
    })
  })
})
