import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { InMemoryStatusStore } from '../../../../shared/infra/inmemory'

const prismaHolder = vi.hoisted(() => {
  const db = {
    conversions: new Map<string, any>(),
    jobs: new Map<string, any>(),
  }

  const prisma = {
    conversion: {
      findUnique: vi.fn(async (args: any) => {
        const conv = db.conversions.get(args.where.conversionId)
        if (!conv) return null
        if (args.include) {
          const jobs = [...db.jobs.values()]
            .filter((j) => j.conversionId === conv.id)
            .sort((a, b) => a.bookIndex - b.bookIndex)
          return { ...conv, jobs }
        }
        return { id: conv.id, conversionId: conv.conversionId }
      }),
      update: vi.fn(async (args: any) => {
        const existing = db.conversions.get(args.where.conversionId)
        if (!existing) return null
        const updated = { ...existing, ...args.data }
        db.conversions.set(args.where.conversionId, updated)
        return updated
      }),
    },
    conversionJob: {
      findMany: vi.fn(async (args: any) => {
        return [...db.jobs.values()]
          .filter((j) => j.conversionId === args.where.conversionId)
          .sort((a, b) => a.bookIndex - b.bookIndex)
      }),
    },
  }

  function seedConversion(row: any): void {
    db.conversions.set(row.conversionId, row)
  }

  function seedJob(row: any): void {
    db.jobs.set(row.jobId, row)
  }

  function reset(): void {
    db.conversions.clear()
    db.jobs.clear()
    prisma.conversion.findUnique.mockClear()
    prisma.conversion.update.mockClear()
    prisma.conversionJob.findMany.mockClear()
  }

  return { prisma, db, seedConversion, seedJob, reset, getPrisma: () => prisma }
})

vi.mock('../../../../shared/database/prisma', () => ({
  getPrisma: prismaHolder.getPrisma,
}))

function seedConversionRow(jobOverrides: Partial<any> = {}): void {
  prismaHolder.reset()
  prismaHolder.seedConversion({
    id: 'conv-1',
    conversionId: 'conv-sync-001',
    status: 'queued',
    progress: 0,
    totalJobs: 1,
    completedJobs: 0,
    failedJobs: 0,
    runningJobs: 0,
    pendingJobs: 1,
    error: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    completedAt: null,
    finishedAt: null,
    userId: 'user-1',
    sourceId: 'src-1',
    cover: { kind: 'original' },
    output: { deviceId: 'K11', format: 'EPUB' },
    metadata: { title: 'Obra Teste' },
    books: [{ title: 'Vol 1', chapters: ['chap_0001'] }],
    options: {},
    errorHandlingStrategy: 'ignore',
  })
  prismaHolder.seedJob({
    jobId: 'job-1',
    conversionId: 'conv-1',
    bookIndex: 0,
    status: 'queued',
    progress: 0,
    outputFile: null,
    outputSize: null,
    downloadUrl: null,
    error: null,
    metadata: { title: 'Vol 1' },
    ...jobOverrides,
  })
}

async function importRepo(): Promise<typeof import('../../repositories/prisma-conversion.repository').PrismaConversionRepository> {
  vi.resetModules()
  const mod = await import('../../repositories/prisma-conversion.repository')
  return mod.PrismaConversionRepository
}

describe('PrismaConversionRepository.syncStatus (modo embedded, store injetado)', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  beforeEach(() => {
    prismaHolder.reset()
  })

  it('merge do status live injetado em job não-terminal', async () => {
    vi.stubEnv('MI_EMBEDDED_MODE', '1')
    seedConversionRow()

    const store = new InMemoryStatusStore()
    await store.set('conv:status:job-1', {
      status: 'downloading',
      progress: 42,
      updatedAt: new Date().toISOString(),
    })

    const Repo = await importRepo()
    const repo = new Repo(store)
    const state = await repo.syncStatus('conv-sync-001')

    expect(state).not.toBeNull()
    expect(state!.jobs[0].status).toBe('downloading')
    expect(state!.jobs[0].progress).toBe(42)
    expect(state!.status).toBe('processing')
    expect(state!.runningJobs).toBe(1)
  })

  it('não lança em embedded com job não-terminal e store vazio', async () => {
    vi.stubEnv('MI_EMBEDDED_MODE', '1')
    seedConversionRow()

    const Repo = await importRepo()
    const repo = new Repo(new InMemoryStatusStore())
    const state = await repo.syncStatus('conv-sync-001')

    expect(state).not.toBeNull()
    expect(state!.status).toBe('queued')
    expect(state!.jobs[0].status).toBe('queued')
  })

  it('sem injeção, default embedded é InMemory — não lança', async () => {
    vi.stubEnv('MI_EMBEDDED_MODE', '1')
    seedConversionRow()

    const Repo = await importRepo()
    const repo = new Repo()
    const state = await repo.syncStatus('conv-sync-001')

    expect(state).not.toBeNull()
    expect(state!.status).toBe('queued')
  })

  it('job terminal não é sobrescrito pelo live store', async () => {
    vi.stubEnv('MI_EMBEDDED_MODE', '1')
    seedConversionRow({
      status: 'completed',
      progress: 100,
      outputFile: 'Vol 1.epub',
      outputSize: 1024,
      downloadUrl: '/api/conversions/conv-sync-001/jobs/job-1/download',
    })

    const store = new InMemoryStatusStore()
    await store.set('conv:status:job-1', {
      status: 'downloading',
      progress: 42,
      updatedAt: new Date().toISOString(),
    })

    const Repo = await importRepo()
    const repo = new Repo(store)
    const state = await repo.syncStatus('conv-sync-001')

    expect(state).not.toBeNull()
    expect(state!.status).toBe('completed')
    expect(state!.completedJobs).toBe(1)
    expect(state!.jobs[0].status).toBe('completed')
    expect(state!.jobs[0].progress).toBe(100)
  })
})
