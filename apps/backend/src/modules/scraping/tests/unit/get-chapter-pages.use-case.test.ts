import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GetChapterPagesUseCase } from '../../use-cases/get-chapter-pages.use-case'
import { SourceNotFoundError } from '../../errors/scraping.errors'
import { ChapterNotFoundError } from '../../errors/chapter-download.errors'

const mockSourceRepo = vi.hoisted(() => ({
  load: vi.fn(),
  save: vi.fn(),
}))

const mockProvider = vi.hoisted(() => ({
  getChapterImages: vi.fn(),
  downloadImage: vi.fn(),
}))

const mockChapterImageService = vi.hoisted(() => ({
  readManifest: vi.fn(),
  writeManifest: vi.fn(),
}))

vi.mock('../../../../shared/database/repositories', () => ({
  getSourceRepository: () => mockSourceRepo,
}))

vi.mock('../../utils/resolve-provider', () => ({
  resolveProvider: vi.fn(async () => mockProvider),
}))

vi.mock('../../services/chapter-image.service', () => ({
  ChapterImageService: vi.fn().mockImplementation(() => mockChapterImageService),
}))

describe('GetChapterPagesUseCase', () => {
  let useCase: GetChapterPagesUseCase

  beforeEach(() => {
    vi.clearAllMocks()
    useCase = new GetChapterPagesUseCase()
  })

  it('deve lançar SourceNotFoundError quando a obra não existe', async () => {
    mockSourceRepo.load.mockResolvedValue(null)

    await expect(useCase.execute('src-nao-existe', 'chap_0001')).rejects.toThrow(
      SourceNotFoundError,
    )
  })

  it('deve lançar ChapterNotFoundError quando o capítulo não existe na obra', async () => {
    mockSourceRepo.load.mockResolvedValue({
      sourceId: 'src-obra-1',
      chapters: [{ id: 'chap_0002', url: 'https://example.com/ch2' }],
    })

    await expect(useCase.execute('src-obra-1', 'chap_0001')).rejects.toThrow(
      ChapterNotFoundError,
    )
  })

  it('deve retornar totalPages do manifesto se manifest.json já existe', async () => {
    mockSourceRepo.load.mockResolvedValue({
      sourceId: 'src-obra-1',
      chapters: [{ id: 'chap_0001', url: 'https://example.com/ch1' }],
    })

    mockChapterImageService.readManifest.mockResolvedValue({
      totalImages: 15,
      urls: Array.from({ length: 15 }, (_, i) => `https://cdn.example.com/p${i + 1}.jpg`),
    })

    const result = await useCase.execute('src-obra-1', 'chap_0001')

    expect(result.sourceId).toBe('src-obra-1')
    expect(result.chapterId).toBe('chap_0001')
    expect(result.totalPages).toBe(15)
    expect(result.pageUrls).toHaveLength(15)
    expect(result.pageUrls[0]).toBe('/api/sources/src-obra-1/chapters/chap_0001/images/1')
    expect(mockProvider.getChapterImages).not.toHaveBeenCalled()
  })

  it('deve buscar URLs no provider e salvar manifesto se manifest.json não existe', async () => {
    mockSourceRepo.load.mockResolvedValue({
      sourceId: 'src-obra-1',
      chapters: [{ id: 'chap_0001', url: 'https://example.com/ch1' }],
    })

    mockChapterImageService.readManifest.mockResolvedValue(null)
    const mockUrls = [
      'https://cdn.example.com/1.jpg',
      'https://cdn.example.com/2.jpg',
      'https://cdn.example.com/3.jpg',
    ]
    mockProvider.getChapterImages.mockResolvedValue(mockUrls)

    const result = await useCase.execute('src-obra-1', 'chap_0001')

    expect(result.totalPages).toBe(3)
    expect(result.pageUrls).toHaveLength(3)
    expect(mockChapterImageService.writeManifest).toHaveBeenCalledWith({
      totalImages: 3,
      urls: mockUrls,
    })
  })
})
