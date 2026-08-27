import { describe, expect, it, beforeEach, vi } from 'vitest'
import { join } from 'node:path'

const mockPubsubInstance = vi.hoisted(() => ({
  publish: vi.fn().mockResolvedValue(undefined),
  subscribe: vi.fn().mockResolvedValue({ unsubscribe: vi.fn().mockResolvedValue(undefined) }),
  subscribeMany: vi.fn().mockResolvedValue({ unsubscribe: vi.fn().mockResolvedValue(undefined) }),
  unsubscribe: vi.fn().mockResolvedValue(undefined),
  unsubscribeMany: vi.fn().mockResolvedValue(undefined),
}))

const mockJournalInstance = vi.hoisted(() => ({
  append: vi.fn().mockResolvedValue(undefined),
  range: vi.fn().mockResolvedValue([]),
  nextId: vi.fn().mockResolvedValue(1),
  expire: vi.fn().mockResolvedValue(undefined),
}))

const mockEventsInstance = vi.hoisted(() => ({
  createEvent: vi.fn((type: string, data: Record<string, unknown> = {}) => ({
    type,
    data,
    timestamp: '2024-01-01T00:00:00.000Z',
  })),
  emit: vi.fn().mockResolvedValue(undefined),
  connectToSSE: vi.fn(),
}))

const mockSetJobStatusFn = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const mockResolveProviderFn = vi.hoisted(() => vi.fn())
const mockLoadFn = vi.hoisted(() => vi.fn())
const mockWriteFile = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const mockMkdirp = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))

const mockImageServiceInstance = vi.hoisted(() => ({
  writeManifest: vi.fn().mockResolvedValue(undefined),
  getCacheDir: vi.fn().mockReturnValue('/test/storage/sources/src-test/chapters/chap-test'),
  readManifest: vi.fn(),
  isCached: vi.fn(),
  getImageUrls: vi.fn(),
}))

vi.mock('../../../../shared/config/env', () => ({
  env: {
    STORAGE_PATH: '/test/storage',
    REDIS_URL: 'redis://localhost:6379',
  },
}))

const mockUpdateUnavailableFn = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))

vi.mock('../../../../shared/database/repositories', () => ({
  getSourceRepository: () => ({
    load: mockLoadFn,
    updateChapterUnavailableReason: mockUpdateUnavailableFn,
  }),
  getNotificationRepository: vi.fn(() => ({})),
}))

vi.mock('../../utils/resolve-provider', () => ({
  resolveProvider: mockResolveProviderFn,
}))

vi.mock('../../../../shared/infra/redis', () => ({
  RedisPubSubAdapter: vi.fn(() => mockPubsubInstance),
  RedisJournalAdapter: vi.fn(() => mockJournalInstance),
}))

vi.mock('../../services/chapter-download-events.service', () => ({
  ChapterDownloadEventsService: vi.fn(() => mockEventsInstance),
}))

vi.mock('../../services/chapter-download-status-store', () => ({
  setJobStatus: mockSetJobStatusFn,
  getJobStatus: vi.fn(),
}))

vi.mock('../../services/chapter-image.service', () => ({
  ChapterImageService: vi.fn(() => mockImageServiceInstance),
}))

vi.mock('node:fs/promises', () => ({
  writeFile: mockWriteFile,
}))

vi.mock('../../../../shared/utils/filesystem', () => ({
  mkdirp: mockMkdirp,
}))

import { processChapterDownload } from '../../workers/chapter-download.worker'

function createMockProvider() {
  return {
    slug: 'test',
    name: 'Test Provider',
    engine: 'cheerio' as const,
    urlPattern: /test/,
    allowedDomains: ['test.com'],
    rateLimiter: {} as any,
    supports: vi.fn(() => true),
    getInfo: vi.fn(() => ({ slug: 'test', name: 'Test Provider', engine: 'cheerio' })),
    inspect: vi.fn(),
    getChapterImages: vi.fn(),
    downloadImage: vi.fn(),
  }
}

function createSourceStub(chapterId: string) {
  return {
    sourceId: 'src-test',
    status: 'ready',
    provider: { slug: 'test', name: 'Test', engine: 'cheerio' },
    source: { url: 'https://test.com/manga/test/', language: null },
    metadata: { title: 'Test Manga', author: 'Author', description: null, status: 'ongoing', genres: [] },
    chapters: [
      {
        id: chapterId,
        number: '1',
        title: 'Chapter 1',
        url: 'https://test.com/chapter/1',
        pages: 0,
        volume: null,
        isDownloaded: false,
      },
    ],
    covers: [],
    statistics: { chapters: 1, covers: 0 },
    cache: { createdAt: '2024-01-01', updatedAt: '2024-01-01', lastAccessAt: '2024-01-01', cacheTtlHours: 24, retentionDays: null },
  }
}

describe('processChapterDownload', () => {
  let provider: ReturnType<typeof createMockProvider>

  beforeEach(() => {
    vi.clearAllMocks()
    provider = createMockProvider()

    mockLoadFn.mockResolvedValue(createSourceStub('chap-test'))
    mockResolveProviderFn.mockResolvedValue(provider)
    provider.getChapterImages.mockResolvedValue(['https://test.com/img1.jpg', 'https://test.com/img2.jpg'])
    provider.downloadImage.mockResolvedValue({ buffer: Buffer.from('fake-image'), contentType: 'image/jpeg' })
  })

  it('deve baixar imagens, escrever manifest e emitir eventos', async () => {
    await processChapterDownload({ data: { sourceId: 'src-test', chapterId: 'chap-test' }, id: 'job-1' })

    expect(mockSetJobStatusFn).toHaveBeenCalledWith('src-test', 'chap-test', 'job-1', 'downloading')
    expect(mockSetJobStatusFn).toHaveBeenCalledWith('src-test', 'chap-test', 'job-1', 'completed')

    expect(mockImageServiceInstance.writeManifest).toHaveBeenCalledWith({
      totalImages: 2,
      urls: ['https://test.com/img1.jpg', 'https://test.com/img2.jpg'],
    })

    expect(mockEventsInstance.createEvent).toHaveBeenCalledWith('progress', {
      downloaded: 0,
      total: 2,
    })

    expect(mockEventsInstance.emit).toHaveBeenCalledTimes(4)
    expect(mockEventsInstance.emit).toHaveBeenNthCalledWith(
      1,
      'src-test',
      'chap-test',
      expect.objectContaining({ type: 'progress', data: { downloaded: 0, total: 2 } }),
    )
    expect(mockEventsInstance.emit).toHaveBeenNthCalledWith(
      2,
      'src-test',
      'chap-test',
      expect.objectContaining({ type: 'progress', data: { downloaded: 1, total: 2 } }),
    )
    expect(mockEventsInstance.emit).toHaveBeenNthCalledWith(
      3,
      'src-test',
      'chap-test',
      expect.objectContaining({ type: 'progress', data: { downloaded: 2, total: 2 } }),
    )
    expect(mockEventsInstance.emit).toHaveBeenNthCalledWith(
      4,
      'src-test',
      'chap-test',
      expect.objectContaining({ type: 'completed', data: { totalImages: 2, downloaded: 2, errors: 0 } }),
    )

    expect(mockWriteFile).toHaveBeenCalledTimes(2)
    expect(mockWriteFile).toHaveBeenNthCalledWith(
      1,
      join('/test/storage/sources/src-test/chapters/chap-test', '0001.jpg'),
      expect.any(Buffer),
    )
    expect(mockWriteFile).toHaveBeenNthCalledWith(
      2,
      join('/test/storage/sources/src-test/chapters/chap-test', '0002.jpg'),
      expect.any(Buffer),
    )

    expect(mockMkdirp).toHaveBeenCalled()
  })

  it('deve emitir failed quando getChapterImages retorna array vazio', async () => {
    provider.getChapterImages.mockResolvedValue([])

    await expect(
      processChapterDownload({ data: { sourceId: 'src-test', chapterId: 'chap-test' }, id: 'job-1' }),
    ).rejects.toThrow('Nenhuma imagem encontrada')

    expect(mockSetJobStatusFn).toHaveBeenCalledWith('src-test', 'chap-test', 'job-1', 'downloading')
    expect(mockSetJobStatusFn).toHaveBeenCalledWith(
      'src-test',
      'chap-test',
      'job-1',
      'failed',
      'Nenhuma imagem encontrada para o capítulo chap-test',
    )

    expect(mockEventsInstance.emit).toHaveBeenCalledWith(
      'src-test',
      'chap-test',
      expect.objectContaining({ type: 'failed', data: { error: 'Nenhuma imagem encontrada para o capítulo chap-test' } }),
    )
  })

  it('deve emitir failed quando resolveProvider retorna null', async () => {
    mockResolveProviderFn.mockResolvedValue(null)

    await expect(
      processChapterDownload({ data: { sourceId: 'src-test', chapterId: 'chap-test' }, id: 'job-1' }),
    ).rejects.toThrow('Provider não encontrado')

    expect(mockSetJobStatusFn).toHaveBeenCalledWith('src-test', 'chap-test', 'job-1', 'downloading')
    expect(mockSetJobStatusFn).toHaveBeenCalledWith(
      'src-test',
      'chap-test',
      'job-1',
      'failed',
      'Provider não encontrado para source src-test',
    )

    expect(mockEventsInstance.emit).toHaveBeenCalledWith(
      'src-test',
      'chap-test',
      expect.objectContaining({ type: 'failed' }),
    )
  })

  it('deve emitir failed quando todas as imagens falham no download', async () => {
    provider.downloadImage.mockRejectedValue(new Error('Network error'))

    await expect(
      processChapterDownload({ data: { sourceId: 'src-test', chapterId: 'chap-test' }, id: 'job-1' }),
    ).rejects.toThrow('Falha ao baixar todas as 2 imagens')

    expect(mockSetJobStatusFn).toHaveBeenCalledWith('src-test', 'chap-test', 'job-1', 'downloading')
    expect(mockSetJobStatusFn).toHaveBeenCalledWith(
      'src-test',
      'chap-test',
      'job-1',
      'failed',
      'Falha ao baixar todas as 2 imagens',
    )

    expect(mockEventsInstance.emit).toHaveBeenCalledWith(
      'src-test',
      'chap-test',
      expect.objectContaining({ type: 'failed', data: { error: 'Falha ao baixar todas as 2 imagens' } }),
    )

    expect(mockWriteFile).not.toHaveBeenCalled()
  })

  it('envia sucesso ao AGREGADOR quando há userId no payload', async () => {
    const push = vi.fn()
    const aggregator = { push } as never

    await processChapterDownload({
      data: { sourceId: 'src-test', chapterId: 'chap-test', userId: 'user-1' },
      id: 'job-1',
    }, undefined, aggregator)

    expect(push).toHaveBeenCalledTimes(1)
    expect(push).toHaveBeenCalledWith({
      userId: 'user-1',
      sourceId: 'src-test',
      sourceTitle: 'Test Manga',
      chapterId: 'chap-test',
      chapterLabel: 'Capítulo 1',
      ok: true,
    })
  })

  it('não envia ao agregador sem userId no payload (retrocompatibilidade)', async () => {
    const push = vi.fn()
    const aggregator = { push } as never

    await processChapterDownload(
      { data: { sourceId: 'src-test', chapterId: 'chap-test' }, id: 'job-1' },
      undefined,
      aggregator,
    )

    expect(push).not.toHaveBeenCalled()
  })

  it('suprime o evento quando o job pertence a um batchId (lote agrega por conta própria)', async () => {
    const push = vi.fn()
    const aggregator = { push } as never

    await processChapterDownload({
      data: { sourceId: 'src-test', chapterId: 'chap-test', userId: 'user-1', batchId: 'batch-1' },
      id: 'job-1',
    }, undefined, aggregator)

    expect(push).not.toHaveBeenCalled()
  })

  it('envia falha ao agregador quando o download falha', async () => {
    provider.downloadImage.mockRejectedValue(new Error('Network error'))
    const push = vi.fn()
    const aggregator = { push } as never

    await expect(
      processChapterDownload({
        data: { sourceId: 'src-test', chapterId: 'chap-test', userId: 'user-1' },
        id: 'job-1',
      }, undefined, aggregator),
    ).rejects.toThrow('Falha ao baixar todas as 2 imagens')

    expect(push).toHaveBeenCalledWith({
      userId: 'user-1',
      sourceId: 'src-test',
      sourceTitle: 'Test Manga',
      chapterId: 'chap-test',
      chapterLabel: 'Capítulo 1',
      ok: false,
      reason: 'Falha ao baixar todas as 2 imagens',
    })
  })
})
