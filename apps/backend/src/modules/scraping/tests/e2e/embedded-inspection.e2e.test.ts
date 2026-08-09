import { vi, describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { FastifyInstance } from 'fastify'

/**
 * E2E embedded (MI_EMBEDDED_MODE=1): o servidor sobe, o POST /inspect enfileira
 * num InMemoryQueueService, o worker REAL `startInspectSourceWorker` processa o
 * job com um provider mockado e persiste via repositório mockado, o SSE
 * pub/sub é in-memory, e `createSafeRedis` NUNCA é chamado.
 */

// ── Repositório in-memory (Map) ───────────────────────────────────────────────
const mockRepo = vi.hoisted(() => {
  const store = new Map<string, any>()
  return {
    reset: () => store.clear(),
    exists: async (id: string) => store.has(id),
    load: async (id: string) => store.get(id) ?? null,
    save: async (id: string, data: any) => { store.set(id, data) },
    update: async (id: string, patch: any) => {
      const current = store.get(id)
      if (current) store.set(id, { ...current, cache: { ...current.cache, ...patch } })
    },
    delete: async (id: string) => { store.delete(id) },
    getPlaceholderIndices: async () => [],
    updatePlaceholderIndices: async () => {},
  }
})

// ── Provider fake (inspected pelo worker) ─────────────────────────────────────
const fakeProvider = vi.hoisted(() => {
  const provider: any = {
    slug: 'mangalivre',
    name: 'Manga Livre',
    engine: 'cheerio',
    rateLimiter: {},
    supports: () => true,
    inspect: vi.fn(),
    getChapterImages: vi.fn(),
    downloadImage: vi.fn(),
  }
  return provider
})

// ── ProviderResolver mockado — resolve() devolve o provider fake ─────────────
const fakeResolver = vi.hoisted(() => ({
  resolve: vi.fn(),
  listAll: vi.fn(() => [fakeProvider]),
}))

// ── Spy de createSafeRedis: QUALQUER chamada quebra o teste ruidosamente ─────
const createSafeRedisMock = vi.hoisted(() =>
  vi.fn(() => { throw new Error('Redis NÃO pode ser usado em embedded') }),
)

vi.mock('../../../../shared/database/repositories', async () => {
  const actual = await vi.importActual<
    typeof import('../../../../shared/database/repositories')
  >('../../../../shared/database/repositories')
  return {
    ...actual,
    getSourceRepository: vi.fn(() => mockRepo),
  }
})

vi.mock('../../providers/provider-resolver', () => ({
  ProviderResolver: vi.fn(() => fakeResolver),
}))

vi.mock('../../../../shared/redis/safe-redis', () => ({
  createSafeRedis: createSafeRedisMock,
  closeAllRedisConnections: vi.fn(),
}))

const INSPECT_URL = 'https://mangalivre.to/manga/test/'

describe('Embedded inspection E2E (MI_EMBEDDED_MODE=1)', () => {
  let app: FastifyInstance
  let tmpDir: string
  let sourceId: string

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'embedded-inspection-'))

    // Envs devem estar setadas ANTES do import dinâmico de createServer
    vi.stubEnv('MI_EMBEDDED_MODE', '1')
    vi.stubEnv('NODE_ENV', 'dev')
    vi.stubEnv('STORAGE_PATH', tmpDir)

    vi.resetModules()

    const serverModule = await import('../../../../shared/server')
    const errorsModule = await import('../../errors/scraping.errors')
    const idGenModule = await import('../../../../shared/utils/id-generator')

    const { ProviderNotFoundError } = errorsModule
    const { createSourceId } = idGenModule

    // Resolve por URL: domínio não suportado lança ProviderNotFoundError;
    // demais URLs devolvem o provider fake (slug mangalivre).
    fakeResolver.resolve.mockImplementation((url: string) => {
      const hostname = new URL(url).hostname
      if (hostname === 'example.com') throw new ProviderNotFoundError(url)
      return fakeProvider
    })

    // sourceId determinístico — igual ao gerado pelo InspectSourceUseCase
    sourceId = createSourceId('mangalivre', INSPECT_URL)

    app = await serverModule.createServer()
  })

  afterAll(async () => {
    await app?.close()
    vi.unstubAllEnvs()
    await rm(tmpDir, { recursive: true, force: true })
  })

  function buildInspectResult(): any {
    return {
      sourceId,
      status: 'ready',
      provider: { slug: 'mangalivre', name: 'Manga Livre', engine: 'cheerio' },
      source: { url: INSPECT_URL, language: null },
      metadata: {
        title: 'Test Manga',
        author: 'Autor',
        description: 'Uma obra de teste',
        status: 'ongoing',
        genres: ['Action'],
      },
      chapters: [
        { id: 'chap_0001', number: '1', title: 'Cap 1', url: 'https://x/ch1/', pages: 1, volume: null },
        { id: 'chap_0002', number: '2', title: 'Cap 2', url: 'https://x/ch2/', pages: 1, volume: null },
      ],
      covers: [{ id: 'cover_001', type: 'original', label: 'Original', imageUrl: 'https://x/cover.jpg' }],
      statistics: { chapters: 2, covers: 1 },
    }
  }

  beforeEach(() => {
    mockRepo.reset()
    fakeProvider.inspect.mockReset()
    fakeProvider.downloadImage.mockReset()
    fakeProvider.inspect.mockImplementation(async () => buildInspectResult())
    fakeProvider.downloadImage.mockImplementation(async () => ({
      buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      contentType: 'image/png',
    }))
  })

  async function pollUntilReady(id: string): Promise<any> {
    const deadline = Date.now() + 15_000
    while (Date.now() < deadline) {
      const res = await app.inject({
        method: 'GET',
        url: `/api/conversions/source/inspect/${id}`,
      })
      if (res.statusCode === 200) {
        const body = res.json()
        if (body.status === 'ready') return body
      }
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    throw new Error(`timeout (15s) aguardando status 'ready' para ${id}`)
  }

  it('POST /inspect → 202 processing; worker real processa; GET → ready; createSafeRedis nunca chamado', async () => {
    const post = await app.inject({
      method: 'POST',
      url: '/api/conversions/source/inspect',
      payload: { url: INSPECT_URL },
    })

    expect(post.statusCode).toBe(202)
    const { sourceId: returnedId, status } = post.json()
    expect(returnedId).toBe(sourceId)
    expect(status).toBe('processing')
    expect(createSafeRedisMock).not.toHaveBeenCalled()

    const ready = await pollUntilReady(sourceId)

    expect(ready.status).toBe('ready')
    expect(ready.metadata.title).toBe('Test Manga')
    expect(ready.chapters).toHaveLength(2)
    expect(ready.chapters[0].title).toBe('Cap 1')
    expect(ready.statistics.chapters).toBe(2)

    // O worker REAL (startInspectSourceWorker) usou o provider mockado.
    // O metadata é salvo ANTES do download da capa — aguarda a conclusão.
    expect(fakeProvider.inspect).toHaveBeenCalled()
    await vi.waitFor(() => expect(fakeProvider.downloadImage).toHaveBeenCalled(), {
      timeout: 5_000,
    })
    expect(createSafeRedisMock).not.toHaveBeenCalled()
  })

  it('POST /inspect com domínio não suportado → 422 (validação intacta no boot embedded)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/conversions/source/inspect',
      payload: { url: 'https://example.com/manga/test/' },
    })

    expect(response.statusCode).toBe(422)
    expect(response.json()).toHaveProperty('error')
    expect(createSafeRedisMock).not.toHaveBeenCalled()
  })

  it('SSE /events: worker publica evento completed via pub/sub in-memory', async () => {
    // Torna o worker lento (delay no inspect) para garantir que a assinatura
    // SSE registre antes do evento 'completed' ser publicado.
    fakeProvider.inspect.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 500))
      return buildInspectResult()
    })

    const ssePromise = app.inject({
      method: 'GET',
      url: `/api/conversions/source/inspect/${sourceId}/events`,
    })

    // Deixa a assinatura do pub/sub in-memory registrar antes do POST
    await new Promise((resolve) => setTimeout(resolve, 250))

    const post = await app.inject({
      method: 'POST',
      url: '/api/conversions/source/inspect',
      payload: { url: INSPECT_URL },
    })
    expect(post.statusCode).toBe(202)

    const sse = await Promise.race([
      ssePromise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout (10s) aguardando evento completed no SSE')), 10_000),
      ),
    ])

    expect(sse.statusCode).toBe(200)
    expect(sse.body).toContain('event: progress')
    expect(sse.body).toContain('event: completed')
    expect(fakeProvider.inspect).toHaveBeenCalled()
    expect(createSafeRedisMock).not.toHaveBeenCalled()
  })
})
