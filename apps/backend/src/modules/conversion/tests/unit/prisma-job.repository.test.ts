import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { getPrisma } from '../../../../shared/database/prisma'
import { PrismaConversionRepository } from '../../repositories/prisma-conversion.repository'
import { PrismaJobRepository } from '../../repositories/prisma-job.repository'
import type { ConversionState, ConversionConfig, ConversionJobState, ConversionJobStatus } from '../../types/conversion.types'

let seq = 0
function nextId(prefix: string): string {
  return `${prefix}-${Date.now()}-${++seq}`
}

function makeConfig(userId: string): ConversionConfig {
  return {
    sourceId: nextId('src-test-job'),
    cover: { kind: 'original' },
    output: { deviceId: 'kindle_pw5', format: 'MOBI' },
    metadata: { title: 'Test', author: 'Author' },
    books: [{ title: 'Volume 1', chapters: ['ch_010'] }],
    options: { webtoon: true },
    errorHandlingStrategy: 'abort',
    userId,
  }
}

function makeConversionState(config: ConversionConfig, convId: string): ConversionState {
  return {
    conversionId: convId,
    status: 'queued',
    progress: 0,
    totalJobs: 1,
    completedJobs: 0,
    failedJobs: 0,
    runningJobs: 0,
    pendingJobs: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    jobs: [{ jobId: `job_${convId}`, index: 0, title: 'Volume 1', status: 'queued', progress: 0 }],
    config,
  }
}

function makeJobState(convId: string, config: ConversionConfig): ConversionJobState {
  const jobId = `job_${convId}`
  return {
    jobId,
    status: 'queued',
    progress: 0,
    currentStep: 'Queued',
    downloadedImages: 0,
    totalImages: 20,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    config: {
      conversionId: convId,
      jobId,
      bookIndex: 0,
      sourceId: config.sourceId,
      chapters: ['ch_010'],
      cover: { kind: 'original' },
      output: { deviceId: 'kindle_pw5', format: 'MOBI' },
      metadata: { title: 'Volume 1' },
      options: { webtoon: true },
      errorHandlingStrategy: 'abort',
    },
  }
}

const USER_ID = '00000000-0000-0000-0000-000000000002'

describe('PrismaJobRepository', () => {
  const convRepo = new PrismaConversionRepository()
  const jobRepo = new PrismaJobRepository()

  beforeAll(async () => {
    await getPrisma().user.upsert({
      where: { id: USER_ID },
      create: { id: USER_ID, username: 'testuser_job', email: 'test-job@test.com', passwordHash: 'hashed' },
      update: {},
    })
  })

  afterAll(async () => {
    await getPrisma().$disconnect()
  })

  async function setupConversion(): Promise<{ convId: string; config: ConversionConfig }> {
    const convId = nextId('conv-job')
    const config = makeConfig(USER_ID)
    await convRepo.create(makeConversionState(config, convId))
    return { convId, config }
  }

  describe('create', () => {
    it('deve criar job usando conversionId do config', async () => {
      const { convId, config } = await setupConversion()
      await jobRepo.create(makeJobState(convId, config))

      const found = await jobRepo.findById(`job_${convId}`)
      expect(found).not.toBeNull()
      expect(found!.jobId).toBe(`job_${convId}`)
      expect(found!.status).toBe('queued')
      expect(found!.config.conversionId).toBe(convId)
    })
  })

  describe('findById', () => {
    it('deve retornar job com config e status', async () => {
      const { convId, config } = await setupConversion()
      await jobRepo.create(makeJobState(convId, config))

      const found = await jobRepo.findById(`job_${convId}`)
      expect(found!.config.bookIndex).toBe(0)
      expect(found!.config.chapters).toEqual(['ch_010'])
      expect(found!.totalImages).toBe(20)
    })

    it('deve retornar null para job inexistente', async () => {
      const found = await jobRepo.findById('job_nonexistent')
      expect(found).toBeNull()
    })
  })

  describe('update', () => {
    it('deve atualizar status e progress', async () => {
      const { convId, config } = await setupConversion()
      await jobRepo.create(makeJobState(convId, config))

      await jobRepo.update(`job_${convId}`, {
        status: 'converting',
        progress: 42,
        currentStep: 'Running KCC',
      } as Partial<ConversionJobStatus>)

      const found = await jobRepo.findById(`job_${convId}`)
      expect(found!.status).toBe('converting')
      expect(found!.progress).toBe(42)
      expect(found!.currentStep).toBe('Running KCC')
      expect(found!.config.chapters).toEqual(['ch_010'])
    })

    it('deve persistir output metadata ao concluir', async () => {
      const { convId, config } = await setupConversion()
      await jobRepo.create(makeJobState(convId, config))

      await jobRepo.update(`job_${convId}`, {
        status: 'completed',
        progress: 100,
        outputFile: 'test.epub',
        outputSize: 1048576,
        downloadUrl: '/api/download/test',
        completedAt: new Date().toISOString(),
      } as Partial<ConversionJobStatus>)

      const found = await jobRepo.findById(`job_${convId}`)
      expect(found!.status).toBe('completed')
      expect(found!.outputFile).toBe('test.epub')
      expect(found!.outputSize).toBe(1048576)
      expect(found!.downloadUrl).toBe('/api/download/test')
      expect(found!.completedAt).toBeDefined()
    })
  })

})
