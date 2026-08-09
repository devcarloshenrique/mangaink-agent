import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { mkdtemp, rm, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { FastifyInstance } from 'fastify'
import { InMemoryConversionRepository } from '../helpers/in-memory-conversion.repository'
import { InMemoryUserRepository } from '../../../auth/tests/helpers/in-memory-user.repository'

/**
 * E2E embedded (MI_EMBEDDED_MODE=1): com `MI_EMBEDDED_MODE=1`, o servidor sobe
 * sem Redis e o POST /api/conversions/:conversionId/jobs/:jobId/preview
 * enfileira no InMemoryQueueService 'mobi-preview'. O worker REAL
 * `startMobiPreviewWorker` roda o fluxo completo: clearTemp → status
 * 'extracting' → runner MOCKADO (escreve index.json + páginas em outputDir/images
 * chamando onTick) → status 'ready' com totalPages/readyPages. O GET status
 * responde `ready` (2/2) e o GET da página responde 200 image/png.
 * `createSafeRedis` NUNCA é chamado.
 */

// ── Spy de createSafeRedis: QUALQUER chamada quebra o teste ruidosamente ──────
const createSafeRedisMock = vi.hoisted(() =>
  vi.fn(() => { throw new Error('Redis NÃO pode ser usado em embedded') }),
)

// ── Runner de MOBI mockado: escreve index.json + páginas e chama onTick ──────
const unpackRunnerMock = vi.hoisted(() => {
  const runs: Array<{
    jobId: string
    mobiPath: string
    outputDir: string
    onTickCalled: boolean
  }> = []
  return {
    runs,
    reset: () => { runs.length = 0 },
    async run(opts: any) {
      const { mkdir, writeFile } = await import('node:fs/promises')
      const { join } = await import('node:path')
      runs.push({ jobId: opts.jobId, mobiPath: opts.mobiPath, outputDir: opts.outputDir, onTickCalled: false })
      const run = runs[runs.length - 1]

      await mkdir(join(opts.outputDir, 'images'), { recursive: true })

      // SHAPE real do index.json (lido por MobiPreviewService.readIndex):
      // { sourceMobi, extractedAt, pages: [{ index, filename, contentType }] }
      const index = {
        sourceMobi: opts.mobiPath.split(/[\\/]/).pop() ?? 'test.mobi',
        extractedAt: new Date().toISOString(),
        pages: [
          { index: 0, filename: '0001.png', contentType: 'image/png' },
          { index: 1, filename: '0002.png', contentType: 'image/png' },
        ],
      }
      await writeFile(join(opts.outputDir, 'index.json'), JSON.stringify(index), 'utf8')
      await writeFile(join(opts.outputDir, 'images', '0001.png'), Buffer.from('PNG-001'), 'utf8')
      await writeFile(join(opts.outputDir, 'images', '0002.png'), Buffer.from('PNG-002'), 'utf8')

      // onTick pelo menos uma vez (worker atualiza readyPages parciais)
      await opts.onTick?.()
      run.onTickCalled = true
    },
  }
})

// ── Holders: instâncias reais injetadas nos mocks de módulo ──────────────────
const repoHolder = vi.hoisted(() => ({
  conversion: null as any,
  job: null as any,
  source: null as any,
}))
const userRepoHolder = vi.hoisted(() => ({ repo: null as any }))

// ── Mocks de módulo ───────────────────────────────────────────────────────────
vi.mock('../../../../shared/database/repositories', async () => {
  const actual = await vi.importActual<
    typeof import('../../../../shared/database/repositories')
  >('../../../../shared/database/repositories')
  return {
    ...actual,
    getSourceRepository: () => repoHolder.source,
    getConversionRepository: () => repoHolder.conversion,
    getConversionJobRepository: () => repoHolder.job,
  }
})

vi.mock('../../../user/repositories/prisma-user.repository', () => ({
  PrismaUserRepository: vi.fn(() => userRepoHolder.repo),
}))

vi.mock('../../../scraping/providers/provider-resolver', () => ({
  ProviderResolver: vi.fn(() => ({ resolve: vi.fn(), listAll: vi.fn(() => []) })),
}))

vi.mock('../../services/kcc-runner.service', () => ({
  KccRunnerService: vi.fn(() => ({ run: vi.fn() })),
}))

vi.mock('../../services/kcc-runner.factory', () => ({
  createKccRunner: vi.fn(() => ({ run: vi.fn() })),
}))

vi.mock('../../services/mobi-unpack-runner.service', () => ({
  MobiUnpackRunnerService: vi.fn(() => unpackRunnerMock),
}))

vi.mock('../../services/mobi-unpack-runner.factory', () => ({
  createMobiUnpackRunner: vi.fn(() => unpackRunnerMock),
}))

vi.mock('../../../../shared/redis/safe-redis', () => ({
  createSafeRedis: createSafeRedisMock,
  closeAllRedisConnections: vi.fn(),
}))

// ── Repositório de Jobs in-memory (o use-case usa findById; o worker appendLog) ─
class InMemoryPreviewJobRepo {
  public store = new Map<string, any>()
  public logs: string[] = []

  async create(job: any): Promise<void> {
    this.store.set(job.jobId, { ...job })
  }

  async findById(jobId: string): Promise<any | null> {
    return this.store.get(jobId) ?? null
  }

  async update(jobId: string, patch: any): Promise<void> {
    const current = this.store.get(jobId)
    if (current) this.store.set(jobId, { ...current, ...patch })
  }

  async delete(jobId: string): Promise<void> {
    this.store.delete(jobId)
  }

  async appendLog(_jobId: string, message: string): Promise<void> {
    this.logs.push(message)
  }

  reset(): void {
    this.store.clear()
    this.logs = []
  }
}

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

const CONVERSION_ID = 'conv-preview-001'
const JOB_ID = 'job-preview-001'
const OUTPUT_FILE = 'test.mobi'

describe('Embedded preview MOBI E2E (MI_EMBEDDED_MODE=1)', () => {
  let app: FastifyInstance
  let tmpDir: string
  let token: string
  let userId: string

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'embedded-mobi-preview-'))

    // Envs DEVEM estar setadas ANTES do import dinâmico de createServer
    vi.stubEnv('MI_EMBEDDED_MODE', '1')
    vi.stubEnv('NODE_ENV', 'dev') // workers só iniciam quando NODE_ENV !== 'test'
    vi.stubEnv('STORAGE_PATH', tmpDir)
    vi.stubEnv('CONVERSIONS_STORAGE_PATH', join(tmpDir, 'conversions'))
    vi.stubEnv('JWT_SECRET', 'test-secret-embedded-mobi-preview')

    vi.resetModules()

    repoHolder.conversion = new InMemoryConversionRepository()
    repoHolder.job = new InMemoryPreviewJobRepo()
    repoHolder.source = new InMemorySourceRepo()
    userRepoHolder.repo = new InMemoryUserRepository()

    const serverModule = await import('../../../../shared/server')
    app = await serverModule.createServer()

    const reg = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        username: 'previewuser',
        email: 'preview@example.com',
        password: 'senha1234',
        confirmPassword: 'senha1234',
      },
    })
    expect(reg.statusCode).toBe(201)
    token = reg.json().token
    userId = reg.json().user.id
  })

  afterAll(async () => {
    await app?.close()
    vi.unstubAllEnvs()
    await rm(tmpDir, { recursive: true, force: true })
  })

  function resetState(): void {
    repoHolder.conversion.reset()
    repoHolder.job.reset()
    repoHolder.source.reset()
    unpackRunnerMock.reset()
    createSafeRedisMock.mockClear()
  }

  /** Semeia Conversion + Job concluídos (outputFile .mobi) no repositório mockado. */
  function seedPreviewFixture(): { conversionId: string; jobId: string } {
    const now = new Date().toISOString()
    const conversion = {
      conversionId: CONVERSION_ID,
      status: 'completed',
      progress: 100,
      totalJobs: 1,
      completedJobs: 1,
      failedJobs: 0,
      runningJobs: 0,
      pendingJobs: 0,
      createdAt: now,
      updatedAt: now,
      jobs: [
        { jobId: JOB_ID, index: 0, title: 'Vol 1', status: 'completed', progress: 100, outputFile: OUTPUT_FILE },
      ],
      config: {
        sourceId: 'src-preview',
        cover: { kind: 'original' },
        output: { deviceId: 'K11', format: 'MOBI' },
        metadata: { title: 'Obra Preview' },
        books: [],
        options: {},
        userId,
        errorHandlingStrategy: 'ignore',
      },
    }
    const job = {
      jobId: JOB_ID,
      status: 'completed',
      progress: 100,
      currentStep: 'Done',
      downloadedImages: 2,
      totalImages: 2,
      createdAt: now,
      updatedAt: now,
      outputFile: OUTPUT_FILE,
      config: {
        conversionId: CONVERSION_ID,
        jobId: JOB_ID,
        bookIndex: 0,
        sourceId: 'src-preview',
        chapters: [],
        cover: { kind: 'original' },
        output: { deviceId: 'K11', format: 'MOBI' },
        metadata: { title: 'Vol 1' },
        options: {},
        errorHandlingStrategy: 'ignore',
      },
    }
    repoHolder.conversion.store.set(CONVERSION_ID, conversion)
    repoHolder.job.store.set(JOB_ID, job)
    return { conversionId: CONVERSION_ID, jobId: JOB_ID }
  }

  async function pollUntilReady(conversionId: string, jobId: string): Promise<any> {
    const deadline = Date.now() + 15_000
    while (Date.now() < deadline) {
      const res = await app.inject({
        method: 'GET',
        url: `/api/conversions/${conversionId}/jobs/${jobId}/preview`,
        headers: { authorization: `Bearer ${token}` },
      })
      if (res.statusCode === 200) {
        const body = res.json()
        if (body.status === 'ready' || body.status === 'failed') return body
      }
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    throw new Error(`timeout (15s) aguardando preview ${jobId} ficar ready`)
  }

  it('POST /preview → 202; worker REAL roda até ready (2/2); GET página → 200 image/png; createSafeRedis nunca chamado', async () => {
    resetState()
    const { conversionId, jobId } = seedPreviewFixture()

    const post = await app.inject({
      method: 'POST',
      url: `/api/conversions/${conversionId}/jobs/${jobId}/preview`,
      headers: { authorization: `Bearer ${token}` },
    })

    expect(post.statusCode).toBe(202)
    expect(post.json()).toEqual({ status: 'processing', cached: false })
    expect(createSafeRedisMock).not.toHaveBeenCalled()

    const status = await pollUntilReady(conversionId, jobId)

    expect(status.status).toBe('ready')
    expect(status.totalPages).toBe(2)
    expect(status.readyPages).toBe(2)
    expect(status.cacheUntil).toBeTruthy()

    // Worker REAL rodou: logs de início e conclusão no job repository
    expect(
      repoHolder.job.logs.some((l: string) => l.includes('extracao iniciada')),
    ).toBe(true)
    expect(
      repoHolder.job.logs.some((l: string) => l.includes('extração concluída — 2 página(s)')),
    ).toBe(true)

    // Runner mockado recebeu mobiPath terminando em test.mobi e outputDir existente
    expect(unpackRunnerMock.runs).toHaveLength(1)
    expect(unpackRunnerMock.runs[0].jobId).toBe(jobId)
    expect(unpackRunnerMock.runs[0].mobiPath.endsWith(OUTPUT_FILE)).toBe(true)
    expect(unpackRunnerMock.runs[0].outputDir.includes('temp')).toBe(true)
    expect(unpackRunnerMock.runs[0].onTickCalled).toBe(true)

    // outputDir com index.json + imagens (prova que o cache /temp foi escrito)
    const images = await readdir(join(unpackRunnerMock.runs[0].outputDir, 'images'))
    expect(images.sort()).toEqual(['0001.png', '0002.png'])

    const page = await app.inject({
      method: 'GET',
      url: `/api/conversions/${conversionId}/jobs/${jobId}/preview/pages/0`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(page.statusCode).toBe(200)
    expect(page.headers['content-type']).toMatch(/^image\//)
    expect(page.rawPayload.length).toBeGreaterThan(0)

    expect(createSafeRedisMock).not.toHaveBeenCalled()
  })

  it('POST /preview idempotente (cache /temp válido) → 200 cached:true; GET /preview/pages/99 → 400 VALIDATION_ERROR; sem Redis', async () => {
    resetState()
    const { conversionId, jobId } = seedPreviewFixture()

    // Cache /temp ainda válido do teste anterior (mesmo tmpDir) → cache hit,
    // sem enfileirar nada de novo.
    const post = await app.inject({
      method: 'POST',
      url: `/api/conversions/${conversionId}/jobs/${jobId}/preview`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(post.statusCode).toBe(200)
    expect(post.json()).toEqual({ status: 'ready', totalPages: 2, cached: true })
    expect(unpackRunnerMock.runs).toHaveLength(0)

    // Página fora do intervalo → InvalidPageIndexError (VALIDATION_ERROR → 400)
    const page = await app.inject({
      method: 'GET',
      url: `/api/conversions/${conversionId}/jobs/${jobId}/preview/pages/99`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(page.statusCode).toBe(400)
    expect(page.json().error).toMatch(/Índice de página inválido/)

    expect(createSafeRedisMock).not.toHaveBeenCalled()
  })
})
