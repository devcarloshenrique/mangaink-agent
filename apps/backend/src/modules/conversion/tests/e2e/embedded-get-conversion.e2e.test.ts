import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { FastifyInstance } from 'fastify'
import { InMemoryUserRepository } from '../../../auth/tests/helpers/in-memory-user.repository'

/**
 * E2E embedded de regressão do GET /api/conversions/:id (MI_EMBEDDED_MODE=1).
 * O caminho REAL é exercitado: rotas → use-case → `PrismaConversionRepository`
 * (getConversionRepository() NÃO é mockado — é o objeto de regressão) →
 * `getPrisma()` fake in-memory. O runtime embedded é criado por um mock do
 * `shared/infra/factory` que expõe um holder compartilhado (`runtimeHolder`),
 * então rotas E workers E o teste usam a MESMA instância de `IStatusStore`.
 * `syncStatus()` consome o status store injetado (seção 2) — GET com job
 * não-terminal responde 200 (sem 500) e `createSafeRedis` nunca é chamado.
 */

const VALID_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

const SOURCE_ID = 'src-embedded-get-001'
const SOURCE_URL = 'https://mangalivre.to/manga/obra-teste/'
const CHAPTER_URL = 'https://mangalivre.to/manga/obra-teste/capitulo-1/'
const CHAPTER_ID = 'chap_0001'

/**
 * Porteiro de download: mantém o worker REAL pendurado em `getChapterImages`
 * (status live `downloading`) nos cenários determinísticos; `unblock()` deixa
 * o download fluir (cenário terminal e dreno no close). Evita flakiness e
 * deadlock no `queue.close()` (drain aguarda in-flight).
 */
const downloadGate = vi.hoisted(() => {
  let blocked = true
  const pending: Array<() => void> = []
  return {
    isBlocked: () => blocked,
    block() { blocked = true },
    unblock() {
      blocked = false
      for (const resolve of pending.splice(0)) resolve()
    },
    gate(): Promise<void> {
      if (!blocked) return Promise.resolve()
      return new Promise<void>((resolve) => pending.push(resolve))
    },
    reset() { blocked = true; pending.length = 0 },
  }
})

const fakeProvider = vi.hoisted(() => ({
  slug: 'mangalivre',
  name: 'Manga Livre',
  engine: 'cheerio',
  rateLimiter: {},
  supports: () => true,
  inspect: vi.fn(),
  getChapterImages: vi.fn(),
  downloadImage: vi.fn(),
}))

const fakeResolver = vi.hoisted(() => ({
  resolve: vi.fn(),
  listAll: vi.fn(() => [fakeProvider]),
  loadFromProviders: vi.fn(),
  refresh: vi.fn(),
}))

const createSafeRedisMock = vi.hoisted(() =>
  vi.fn(() => { throw new Error('Redis NÃO pode ser usado em embedded') }),
)

const kccMock = vi.hoisted(() => {
  const runs: Array<{
    jobId: string
    options: Record<string, unknown>
    deviceId: string
    format: string
    inputPath: string
    outputPath: string
    title: string
  }> = []
  return {
    runs,
    reset: () => { runs.length = 0 },
    async run(
      jobId: string,
      options: Record<string, unknown>,
      deviceId: string,
      format: string,
      inputPath: string,
      outputPath: string,
      title: string,
    ) {
      runs.push({ jobId, options, deviceId, format, inputPath, outputPath, title })
      const outputFile = `test.${format.toLowerCase()}`
      const { mkdir, writeFile } = await import('node:fs/promises')
      await mkdir(outputPath, { recursive: true })
      await writeFile(join(outputPath, outputFile), Buffer.from('EPUB-CONTENT'), 'utf8')
      return { success: true, exitCode: 0, outputPath, outputFile, outputSize: 1024 }
    },
  }
})

const runtimeHolder = vi.hoisted(() => ({ runtime: null as any }))
const repoHolder = vi.hoisted(() => ({ source: null as any }))
const userRepoHolder = vi.hoisted(() => ({ repo: null as any }))

/**
 * Fake do `getPrisma()`: Maps in-memory de `conversion` + `conversionJob` com a
 * semântica mínima usada pelo caminho real (PrismaConversionRepository +
 * PrismaJobRepository): findUnique (select vs include), findMany, update, create.
 */
const prismaHolder = vi.hoisted(() => {
  const conversions = new Map<string, any>()
  const jobs = new Map<string, any>()

  const byBookIndex = (list: any[]): any[] =>
    [...list].sort((a, b) => (a.bookIndex ?? 0) - (b.bookIndex ?? 0))

  const fullConversionRow = (conversionId: string): any | null => {
    const row = conversions.get(conversionId)
    if (!row) return null
    return {
      ...row,
      jobs: byBookIndex([...jobs.values()].filter((j) => j.conversionId === row.id)),
    }
  }

  const pick = (row: any, select: Record<string, unknown>): any => {
    const out: any = {}
    for (const key of Object.keys(select)) out[key] = row[key]
    return out
  }

  const conversion = {
    async create(args: any): Promise<void> {
      const d = args.data
      conversions.set(d.conversionId, {
        id: d.conversionId,
        conversionId: d.conversionId,
        userId: d.userId,
        sourceId: d.sourceId,
        cover: d.cover,
        output: d.output,
        metadata: d.metadata,
        books: d.books,
        options: d.options,
        errorHandlingStrategy: d.errorHandlingStrategy ?? null,
        status: d.status,
        progress: d.progress,
        totalJobs: d.totalJobs,
        completedJobs: d.completedJobs,
        failedJobs: d.failedJobs,
        runningJobs: d.runningJobs,
        pendingJobs: d.pendingJobs,
        error: d.error ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: null,
        finishedAt: null,
      })
    },
    async findUnique(args: any): Promise<any | null> {
      const row = conversions.get(args.where?.conversionId)
      if (!row) return null
      if (args.include) return fullConversionRow(row.conversionId)
      if (args.select) return pick(row, args.select)
      return { ...row }
    },
    async findMany(args: any): Promise<any[]> {
      const where = args.where ?? {}
      const rows = [...conversions.values()].filter((r) => {
        if (where.userId && r.userId !== where.userId) return false
        if (where.sourceId && r.sourceId !== where.sourceId) return false
        if (where.status) {
          if (Array.isArray(where.status.in)) return where.status.in.includes(r.status)
          return r.status === where.status
        }
        return true
      })
      rows.sort((a, b) => (b.createdAt?.getTime?.() ?? 0) - (a.createdAt?.getTime?.() ?? 0))
      const skip = args.skip ?? 0
      const take = args.take ?? rows.length
      return rows.slice(skip, skip + take).map((r) => (args.select ? pick(r, args.select) : { ...r }))
    },
    async count(args: any): Promise<number> {
      const where = args.where ?? {}
      return [...conversions.values()].filter((r) => !where.userId || r.userId === where.userId).length
    },
    async update(args: any): Promise<any | null> {
      const row = conversions.get(args.where?.conversionId)
      if (!row) return null
      const updated = { ...row, ...args.data, updatedAt: new Date() }
      if (args.data.completedAt !== undefined) {
        updated.completedAt = args.data.completedAt ? new Date(args.data.completedAt) : null
      }
      if (args.data.finishedAt !== undefined) {
        updated.finishedAt = args.data.finishedAt ? new Date(args.data.finishedAt) : null
      }
      conversions.set(row.conversionId, updated)
      return updated
    },
    async delete(args: any): Promise<void> {
      conversions.delete(args.where?.conversionId)
    },
  }

  const conversionJob = {
    async create(args: any): Promise<void> {
      const d = args.data
      jobs.set(d.jobId, {
        jobId: d.jobId,
        conversionId: d.conversionId,
        sourceId: d.sourceId,
        bookIndex: d.bookIndex,
        chapters: d.chapters ?? [],
        cover: d.cover,
        output: d.output,
        metadata: d.metadata,
        options: d.options,
        errorHandlingStrategy: d.errorHandlingStrategy ?? null,
        status: d.status,
        progress: d.progress,
        currentStep: d.currentStep,
        downloadedImages: d.downloadedImages ?? 0,
        totalImages: d.totalImages ?? 0,
        outputFile: null,
        outputSize: null,
        downloadUrl: null,
        error: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: null,
      })
    },
    async findUnique(args: any): Promise<any | null> {
      const job = jobs.get(args.where?.jobId)
      if (!job) return null
      if (args.include) return { ...job, conversion: { conversionId: job.conversionId } }
      if (args.select) {
        const out: any = {}
        for (const key of Object.keys(args.select)) {
          if (key === 'conversion') out.conversion = { conversionId: job.conversionId }
          else out[key] = job[key]
        }
        return out
      }
      return { ...job }
    },
    async findMany(args: any): Promise<any[]> {
      const where = args.where ?? {}
      return byBookIndex([...jobs.values()].filter((j) => j.conversionId === where.conversionId))
        .map((j) => (args.select ? pick(j, args.select) : { ...j }))
    },
    async update(args: any): Promise<any | null> {
      const job = jobs.get(args.where?.jobId)
      if (!job) return null
      const updated = { ...job, ...args.data, updatedAt: new Date() }
      if (args.data.completedAt !== undefined) {
        updated.completedAt = args.data.completedAt ? new Date(args.data.completedAt) : null
      }
      jobs.set(job.jobId, updated)
      return updated
    },
    async delete(args: any): Promise<void> {
      jobs.delete(args.where?.jobId)
    },
  }

  return {
    conversions,
    jobs,
    conversion,
    conversionJob,
    getPrisma: () => ({ conversion, conversionJob }),
    reset: () => {
      conversions.clear()
      jobs.clear()
    },
  }
})

vi.mock('../../../../shared/infra/factory', async () => {
  const inmemory = await vi.importActual<typeof import('../../../../shared/infra/inmemory')>(
    '../../../../shared/infra/inmemory',
  )
  return {
    createRuntimeAdapters: () => {
      if (!runtimeHolder.runtime) {
        const queueRegistry = new Map<string, any>()
        runtimeHolder.runtime = {
          queue: new inmemory.InMemoryQueueService(),
          getQueue: (name: string) => {
            let queue = queueRegistry.get(name)
            if (!queue) {
              queue = new inmemory.InMemoryQueueService()
              queueRegistry.set(name, queue)
            }
            return queue
          },
          pubsub: new inmemory.InMemoryPubSub(),
          journal: new inmemory.InMemoryJournalStore(),
          status: new inmemory.InMemoryStatusStore(),
          lock: new inmemory.InMemoryLockService(),
        }
      }
      return runtimeHolder.runtime
    },
    createRedisQueueAdapter: vi.fn(),
  }
})

vi.mock('../../../../shared/database/prisma', () => ({
  getPrisma: prismaHolder.getPrisma,
}))

vi.mock('../../../../shared/database/repositories', async () => {
  const actual = await vi.importActual<
    typeof import('../../../../shared/database/repositories')
  >('../../../../shared/database/repositories')
  return {
    ...actual,
    getSourceRepository: () => repoHolder.source,
  }
})

vi.mock('../../../user/repositories/prisma-user.repository', () => ({
  PrismaUserRepository: vi.fn(() => userRepoHolder.repo),
}))

vi.mock('../../../scraping/providers/provider-resolver', () => ({
  ProviderResolver: vi.fn(() => fakeResolver),
}))

vi.mock('../../services/kcc-runner.service', () => ({
  KccRunnerService: vi.fn(() => kccMock),
}))

vi.mock('../../services/kcc-runner.factory', () => ({
  createKccRunner: vi.fn(() => kccMock),
}))

vi.mock('../../services/mobi-unpack-runner.service', () => ({
  MobiUnpackRunnerService: vi.fn(() => ({ run: vi.fn() })),
}))

vi.mock('../../services/mobi-unpack-runner.factory', () => ({
  createMobiUnpackRunner: vi.fn(() => ({ run: vi.fn() })),
}))

vi.mock('../../../../shared/redis/safe-redis', () => ({
  createSafeRedis: createSafeRedisMock,
  closeAllRedisConnections: vi.fn(),
}))

class InMemorySourceRepo {
  private readonly store = new Map<string, any>()

  async exists(sourceId: string): Promise<boolean> {
    return this.store.has(sourceId)
  }

  async load(sourceId: string): Promise<any | null> {
    return this.store.get(sourceId) ?? null
  }

  async save(sourceId: string, data: any): Promise<void> {
    this.store.set(sourceId, data)
  }

  async update(sourceId: string, patch: any): Promise<void> {
    const current = this.store.get(sourceId)
    if (current) this.store.set(sourceId, { ...current, cache: { ...current.cache, ...patch } })
  }

  async delete(sourceId: string): Promise<void> {
    this.store.delete(sourceId)
  }

  async getPlaceholderIndices(): Promise<number[]> {
    return []
  }

  async updatePlaceholderIndices(): Promise<void> {}

  reset(): void {
    this.store.clear()
  }
}

function buildSourceMetadata(): any {
  const now = new Date().toISOString()
  return {
    sourceId: SOURCE_ID,
    status: 'ready',
    provider: { slug: 'mangalivre', name: 'Manga Livre', engine: 'cheerio' },
    source: { url: SOURCE_URL, language: 'pt' },
    metadata: {
      title: 'Obra Teste',
      author: 'Autor Teste',
      description: 'Obra de teste para o E2E embedded de GET conversion',
      status: 'ongoing',
      genres: ['Ação'],
    },
    chapters: [
      {
        id: CHAPTER_ID,
        number: '1',
        title: 'Cap 1',
        url: CHAPTER_URL,
        pages: 1,
        volume: null,
        isDownloaded: false,
        isRead: false,
      },
    ],
    covers: [
      { id: 'cover_001', type: 'original', label: 'Original', imageUrl: 'https://img.test/obra/capa.jpg' },
    ],
    statistics: { chapters: 1, covers: 1 },
    cache: { createdAt: now, updatedAt: now, lastAccessAt: now, cacheTtlHours: 24, retentionDays: 30 },
  }
}

describe('Embedded GET conversion E2E (MI_EMBEDDED_MODE=1, repo real + getPrisma fake)', () => {
  let app: FastifyInstance
  let tmpDir: string
  let token: string

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'embedded-get-conversion-'))

    vi.stubEnv('MI_EMBEDDED_MODE', '1')
    vi.stubEnv('NODE_ENV', 'dev') // workers só iniciam quando NODE_ENV !== 'test'
    vi.stubEnv('STORAGE_PATH', tmpDir)
    vi.stubEnv('CONVERSIONS_STORAGE_PATH', join(tmpDir, 'conversions'))
    vi.stubEnv('JWT_SECRET', 'test-secret-embedded-get-conversion')

    vi.resetModules()

    runtimeHolder.runtime = null
    prismaHolder.reset()
    userRepoHolder.repo = new InMemoryUserRepository()
    repoHolder.source = new InMemorySourceRepo()

    const serverModule = await import('../../../../shared/server')
    app = await serverModule.createServer()

    fakeResolver.resolve.mockImplementation(async () => fakeProvider)
    fakeProvider.getChapterImages.mockImplementation(async () => {
      await downloadGate.gate()
      return ['https://img.test/obra/cap1/0001.png']
    })
    fakeProvider.downloadImage.mockImplementation(async () => {
      await downloadGate.gate()
      return { buffer: Buffer.from(VALID_PNG_BASE64, 'base64'), contentType: 'image/png' }
    })

    await repoHolder.source.save(SOURCE_ID, buildSourceMetadata())

    const reg = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        username: 'getconvuser',
        email: 'getconv@example.com',
        password: 'senha1234',
        confirmPassword: 'senha1234',
      },
    })
    expect(reg.statusCode).toBe(201)
    token = reg.json().token
  })

  afterAll(async () => {
    downloadGate.unblock()
    await app?.close()
    vi.unstubAllEnvs()
    await rm(tmpDir, { recursive: true, force: true })
  })

  async function resetState(): Promise<void> {
    downloadGate.reset()
    prismaHolder.reset()
    repoHolder.source.reset()
    kccMock.reset()
    fakeProvider.inspect.mockClear()
    fakeProvider.getChapterImages.mockClear()
    fakeProvider.downloadImage.mockClear()
    fakeResolver.resolve.mockClear()
    createSafeRedisMock.mockClear()
    await repoHolder.source.save(SOURCE_ID, buildSourceMetadata())
  }

  async function createConversion(): Promise<{ conversionId: string; jobId: string }> {
    const post = await app.inject({
      method: 'POST',
      url: '/api/conversions',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        sourceId: SOURCE_ID,
        cover: { kind: 'original' },
        output: { deviceId: 'K11', format: 'EPUB' },
        metadata: { title: 'Obra Teste', author: 'Autor Teste' },
        books: [{ title: 'Volume 01', chapters: [CHAPTER_ID] }],
        options: {},
      },
    })
    expect(post.statusCode).toBe(202)
    const created = post.json()
    expect(created.status).toBe('queued')
    expect(created.totalJobs).toBe(1)
    expect(created.conversionId).toBeTruthy()
    const jobId = [...prismaHolder.jobs.values()][0]?.jobId ?? ''
    return { conversionId: created.conversionId, jobId }
  }

  async function getConversion(conversionId: string): Promise<any> {
    const res = await app.inject({
      method: 'GET',
      url: `/api/conversions/${conversionId}`,
      headers: { authorization: `Bearer ${token}` },
    })
    return res
  }

  async function pollUntilCompleted(conversionId: string): Promise<any> {
    const deadline = Date.now() + 30_000
    while (Date.now() < deadline) {
      const res = await getConversion(conversionId)
      if (res.statusCode === 200) {
        const body = res.json()
        if (body.status === 'completed' || body.status === 'failed') return body
      }
      await new Promise((resolve) => setTimeout(resolve, 200))
    }
    throw new Error(`timeout (30s) aguardando conversão ${conversionId} completar`)
  }

  async function pollUntilJob(conversionId: string, jobStatus: string, jobProgress?: number): Promise<any> {
    const deadline = Date.now() + 10_000
    while (Date.now() < deadline) {
      const res = await getConversion(conversionId)
      if (res.statusCode === 200) {
        const body = res.json()
        const job = body.jobs?.[0]
        if (job && job.status === jobStatus && (jobProgress === undefined || job.progress === jobProgress)) {
          return body
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    throw new Error(`timeout (10s) aguardando job ${jobStatus} (progress ${jobProgress})`)
  }

  it('POST /api/conversions → 202 { status: queued, totalJobs, conversionId }', async () => {
    await resetState()
    const { conversionId, jobId } = await createConversion()
    expect(jobId).toBeTruthy()
    expect(createSafeRedisMock).not.toHaveBeenCalled()
    downloadGate.unblock()
  })

  it('GET /api/conversions/:id com job não-terminal → 200 (NÃO 500); createSafeRedis nunca chamado', async () => {
    await resetState()
    const { conversionId } = await createConversion()

    const res = await getConversion(conversionId)
    expect(res.statusCode).toBe(200)

    const body = res.json()
    expect(body.conversionId).toBe(conversionId)
    expect(['queued', 'processing']).toContain(body.status)
    expect(Array.isArray(body.jobs)).toBe(true)
    expect(body.jobs).toHaveLength(1)
    expect(['queued', 'preparing', 'downloading']).toContain(body.jobs[0].status)
    expect(typeof body.progress).toBe('number')
    expect(createSafeRedisMock).not.toHaveBeenCalled()
    downloadGate.unblock()
  })

  it('job não-terminal com status live no store → GET reflete downloading + progresso 42', async () => {
    await resetState()
    const { conversionId, jobId } = await createConversion()

    await runtimeHolder.runtime.status.set(`conv:status:${jobId}`, {
      status: 'downloading',
      currentStep: 'Downloading images...',
      progress: 42,
      downloadedImages: 1,
      totalImages: 2,
      updatedAt: new Date().toISOString(),
    })

    const body = await pollUntilJob(conversionId, 'downloading', 42)
    expect(body.status).toBe('processing')
    expect(body.runningJobs).toBeGreaterThanOrEqual(1)
    expect(body.pendingJobs).toBe(0)
    expect(body.jobs[0].progress).toBe(42)
    expect(createSafeRedisMock).not.toHaveBeenCalled()
    downloadGate.unblock()
  })

  it('job terminal → GET reflete completed (worker REAL até o fim, sem Redis)', async () => {
    await resetState()
    downloadGate.unblock()
    const { conversionId } = await createConversion()

    const state = await pollUntilCompleted(conversionId)
    expect(state.status).toBe('completed')
    expect(state.completedJobs).toBeGreaterThanOrEqual(1)
    expect(state.failedJobs).toBe(0)
    expect(state.jobs).toHaveLength(1)
    expect(state.jobs[0].status).toBe('completed')
    expect(state.jobs[0].outputFile).toBe('Volume 01.epub')
    expect(createSafeRedisMock).not.toHaveBeenCalled()
  })

  it('GET /logs → 200 com shape de array (journal in-memory)', async () => {
    await resetState()
    const { conversionId } = await createConversion()

    const res = await app.inject({
      method: 'GET',
      url: `/api/conversions/${conversionId}/logs`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body)).toBe(true)
    for (const entry of body) {
      expect(typeof entry.type).toBe('string')
      expect(typeof entry.timestamp).toBe('string')
    }
    expect(createSafeRedisMock).not.toHaveBeenCalled()
    downloadGate.unblock()
  })

  it('POST /cancel → 200; GET reflete cancelled (agregado + job)', async () => {
    await resetState()
    const { conversionId } = await createConversion()

    const cancel = await app.inject({
      method: 'POST',
      url: `/api/conversions/${conversionId}/cancel`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(cancel.statusCode).toBe(200)
    expect(cancel.json()).toMatchObject({ conversionId, status: 'cancelled' })

    const res = await getConversion(conversionId)
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.status).toBe('cancelled')
    expect(body.failedJobs).toBeGreaterThanOrEqual(1)
    expect(body.jobs[0].status).toBe('cancelled')
    expect(createSafeRedisMock).not.toHaveBeenCalled()
    downloadGate.unblock()
  })
})
