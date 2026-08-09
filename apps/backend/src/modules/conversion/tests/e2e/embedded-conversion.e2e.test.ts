import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { FastifyInstance } from 'fastify'
import { InMemoryConversionRepository } from '../helpers/in-memory-conversion.repository'
import { InMemoryUserRepository } from '../../../auth/tests/helpers/in-memory-user.repository'

/**
 * E2E embedded (MI_EMBEDDED_MODE=1): o servidor sobe sem Redis, o
 * POST /api/conversions cria a Conversion e enfileira os Jobs num
 * InMemoryQueueService compartilhado, e o worker REAL `startConversionJobWorker`
 * processa o Job: download de imagens (provider mockado — validação de magic
 * bytes PASSANDO), escrita de ComicInfo.xml, KCC MOCKADO (grava args e cria
 * arquivo de saída) e atualização de status (IStatusStore in-memory).
 * `createSafeRedis` NUNCA é chamado.
 */

// ── Imagem PNG 1×1 válida — os magic bytes (89 50 4E 47) passam no downloader ──
const VALID_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

const SOURCE_ID = 'src-embedded-conv-001'
const SOURCE_URL = 'https://mangalivre.to/manga/obra-teste/'
const CHAPTER_URL = 'https://mangalivre.to/manga/obra-teste/capitulo-1/'
const CHAPTER_ID = 'chap_0001'

// ── Provider fake (usado pelo worker real via resolveProvider) ────────────────
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

// ── ProviderResolver mockado — resolve() devolve o provider fake ──────────────
const fakeResolver = vi.hoisted(() => ({
  resolve: vi.fn(),
  listAll: vi.fn(() => [fakeProvider]),
}))

// ── Spy de createSafeRedis: QUALQUER chamada quebra o teste ruidosamente ──────
const createSafeRedisMock = vi.hoisted(() =>
  vi.fn(() => { throw new Error('Redis NÃO pode ser usado em embedded') }),
)

// ── KCC mockado: grava os args (assert depois) + cria arquivo de saída ────────
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
  ProviderResolver: vi.fn(() => fakeResolver),
}))

vi.mock('../../services/kcc-runner.service', () => ({
  KccRunnerService: vi.fn(() => kccMock),
}))

vi.mock('../../services/kcc-runner.factory', () => ({
  createKccRunner: vi.fn(() => kccMock),
}))

vi.mock('../../services/mobi-unpack-runner.factory', () => ({
  createMobiUnpackRunner: vi.fn(() => ({ run: vi.fn() })),
}))

vi.mock('../../../../shared/redis/safe-redis', () => ({
  createSafeRedis: createSafeRedisMock,
  closeAllRedisConnections: vi.fn(),
}))

/**
 * Job repo in-memory com write-through: cada `update(jobId, patch)` também
 * espelha o resumo do Job dentro da Conversion (store do
 * InMemoryConversionRepository) para que `syncStatus()` reflita o estado real.
 * Reusa o InMemoryConversionRepository (helper) como repositório de Conversions.
 */
class WriteThroughJobRepo {
  public store = new Map<string, any>()
  public logs: string[] = []

  constructor(private readonly conversions: InMemoryConversionRepository) {}

  async create(job: any): Promise<void> {
    this.store.set(job.jobId, { ...job })
  }

  async findById(jobId: string): Promise<any | null> {
    return this.store.get(jobId) ?? null
  }

  async update(jobId: string, patch: any): Promise<void> {
    const current = this.store.get(jobId)
    if (!current) return
    const updated = { ...current, ...patch, updatedAt: new Date().toISOString() }
    this.store.set(jobId, updated)

    const convId = current.config?.conversionId
    const conv = this.conversions.store.get(convId)
    if (conv) {
      conv.jobs = conv.jobs.map((summary: any) =>
        summary.jobId === jobId
          ? {
              ...summary,
              status: updated.status,
              progress: updated.progress,
              currentStep: updated.currentStep,
              downloadedImages: updated.downloadedImages,
              totalImages: updated.totalImages,
              outputFile: updated.outputFile,
              outputSize: updated.outputSize,
              downloadUrl: updated.downloadUrl,
              error: updated.error,
            }
          : summary,
      )
    }
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
      description: 'Obra de teste para o E2E embedded de conversão',
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

describe('Embedded conversion E2E (MI_EMBEDDED_MODE=1)', () => {
  let app: FastifyInstance
  let tmpDir: string
  let token: string

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'embedded-conversion-'))

    // Envs DEVEM estar setadas ANTES do import dinâmico de createServer
    vi.stubEnv('MI_EMBEDDED_MODE', '1')
    vi.stubEnv('NODE_ENV', 'dev') // workers só iniciam quando NODE_ENV !== 'test'
    vi.stubEnv('STORAGE_PATH', tmpDir)
    vi.stubEnv('CONVERSIONS_STORAGE_PATH', join(tmpDir, 'conversions'))
    vi.stubEnv('JWT_SECRET', 'test-secret-embedded-conversion')

    vi.resetModules()

    repoHolder.conversion = new InMemoryConversionRepository()
    repoHolder.job = new WriteThroughJobRepo(repoHolder.conversion)
    repoHolder.source = new InMemorySourceRepo()
    userRepoHolder.repo = new InMemoryUserRepository()

    const serverModule = await import('../../../../shared/server')
    app = await serverModule.createServer()

    // Provider: resolve por URL → provider fake; imagens → PNG válido (1×1)
    fakeResolver.resolve.mockImplementation(async () => fakeProvider)
    fakeProvider.getChapterImages.mockImplementation(async () => [
      'https://img.test/obra/cap1/0001.png',
    ])
    fakeProvider.downloadImage.mockImplementation(async () => ({
      buffer: Buffer.from(VALID_PNG_BASE64, 'base64'),
      contentType: 'image/png',
    }))

    // Cria a source direto no repositório mockado (o que o create-conversion
    // use-case exige: load(sourceId) com chapters).
    await repoHolder.source.save(SOURCE_ID, buildSourceMetadata())

    const reg = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        username: 'embeddeduser',
        email: 'embedded@example.com',
        password: 'senha1234',
        confirmPassword: 'senha1234',
      },
    })
    expect(reg.statusCode).toBe(201)
    token = reg.json().token
  })

  afterAll(async () => {
    await app?.close()
    vi.unstubAllEnvs()
    await rm(tmpDir, { recursive: true, force: true })
  })

  function resetState(): Promise<void> {
    repoHolder.conversion.reset()
    repoHolder.job.reset()
    repoHolder.source.reset()
    kccMock.reset()
    fakeProvider.inspect.mockClear()
    fakeProvider.getChapterImages.mockClear()
    fakeProvider.downloadImage.mockClear()
    fakeResolver.resolve.mockClear()
    createSafeRedisMock.mockClear()
    return repoHolder.source.save(SOURCE_ID, buildSourceMetadata())
  }

  async function pollUntilCompleted(conversionId: string): Promise<any> {
    const deadline = Date.now() + 30_000
    while (Date.now() < deadline) {
      const res = await app.inject({
        method: 'GET',
        url: `/api/conversions/${conversionId}`,
        headers: { authorization: `Bearer ${token}` },
      })
      if (res.statusCode === 200) {
        const body = res.json()
        if (body.status === 'completed' || body.status === 'failed') return body
      }
      await new Promise((resolve) => setTimeout(resolve, 200))
    }
    throw new Error(`timeout (30s) aguardando conversão ${conversionId} completar`)
  }

  function conversionBody(): any {
    return {
      sourceId: SOURCE_ID,
      cover: { kind: 'original' },
      output: { deviceId: 'K11', format: 'EPUB' },
      metadata: { title: 'Obra Teste', author: 'Autor Teste' },
      books: [{ title: 'Volume 01', chapters: [CHAPTER_ID] }],
      options: {},
    }
  }

  it('POST /api/conversions → 202; worker REAL processa até completed; KCC mockado; createSafeRedis nunca chamado', async () => {
    await resetState()

    const post = await app.inject({
      method: 'POST',
      url: '/api/conversions',
      headers: { authorization: `Bearer ${token}` },
      payload: conversionBody(),
    })

    expect(post.statusCode).toBe(202)
    const created = post.json()
    expect(created.status).toBe('queued')
    expect(created.totalJobs).toBe(1)
    expect(created.conversionId).toBeTruthy()
    expect(createSafeRedisMock).not.toHaveBeenCalled()

    const state = await pollUntilCompleted(created.conversionId)

    expect(state.status).toBe('completed')
    expect(state.completedJobs).toBe(1)
    expect(state.failedJobs).toBe(0)
    expect(state.jobs).toHaveLength(1)
    expect(state.jobs[0].status).toBe('completed')
    expect(state.jobs[0].outputFile).toBe('Volume 01.epub')

    // Provider mockado usado: getChapterImages chamado com a URL do capítulo
    expect(fakeResolver.resolve).toHaveBeenCalledWith(CHAPTER_URL)
    expect(fakeProvider.getChapterImages).toHaveBeenCalledWith(CHAPTER_URL)
    expect(fakeProvider.downloadImage).toHaveBeenCalled()

    // Magic bytes PASSANDO: download sem erros (1/1, 0 erros) — sem corrupt pages
    expect(
      repoHolder.job.logs.some((l: string) => l.includes('download concluído (1/1, 0 erros')),
    ).toBe(true)

    // ComicInfo.xml escrito no input do KCC (prova via log do worker)
    expect(
      repoHolder.job.logs.some((l: string) => l.includes('ComicInfo.xml escrito com título="Volume 01"')),
    ).toBe(true)

    // KCC mockado chamado 1x com device/format corretos + flags do Planner
    expect(kccMock.runs).toHaveLength(1)
    expect(kccMock.runs[0].deviceId).toBe('K11')
    expect(kccMock.runs[0].format).toBe('EPUB')
    expect(kccMock.runs[0].options.batchSplit).toBe('none')
    expect(kccMock.runs[0].options.fileFusion).toBe(false)
    expect(kccMock.runs[0].options.metadataTitle).toBe('metadataOnly')

    // Arquivo de saída renomeado pelo packaging existe em disco
    const outputFile = await readFile(join(kccMock.runs[0].outputPath, 'Volume 01.epub'))
    expect(outputFile.toString()).toBe('EPUB-CONTENT')

    expect(createSafeRedisMock).not.toHaveBeenCalled()
  })

  it('DELETE /api/conversions/:id de conversion recém-criada (job ainda pendente) → deleted; GET → 404; sem Redis', async () => {
    await resetState()

    const post = await app.inject({
      method: 'POST',
      url: '/api/conversions',
      headers: { authorization: `Bearer ${token}` },
      payload: conversionBody(),
    })
    expect(post.statusCode).toBe(202)
    const { conversionId } = post.json()

    const del = await app.inject({
      method: 'DELETE',
      url: `/api/conversions/${conversionId}`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(del.statusCode).toBe(200)
    expect(del.json().status).toBe('deleted')

    const get = await app.inject({
      method: 'GET',
      url: `/api/conversions/${conversionId}`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(get.statusCode).toBe(404)

    expect(createSafeRedisMock).not.toHaveBeenCalled()
  })
})
