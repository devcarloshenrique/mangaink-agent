import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { join } from 'node:path'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { ChapterImageService } from '../../services/chapter-image.service'
import type { IProviderStrategy } from '../../interfaces/provider-strategy.interface'
import type { ChapterManifest } from '../../types/chapter-download.types'

function createMockProvider(): IProviderStrategy {
  return {
    slug: 'test',
    name: 'Test Provider',
    engine: 'cheerio',
    urlPattern: /test/,
    allowedDomains: ['test.com'],
    rateLimiter: {} as any,
    supports: () => true,
    getInfo: () => ({ slug: 'test', name: 'Test Provider', engine: 'cheerio' }),
    inspect: vi.fn(),
    getChapterImages: vi.fn(),
    downloadImage: vi.fn(),
  }
}

describe('ChapterImageService', () => {
  let tempDir: string
  let provider: IProviderStrategy
  let service: ChapterImageService

  beforeEach(async () => {
    tempDir = join(tmpdir(), `mangaink-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    provider = createMockProvider()
    service = new ChapterImageService(provider, 'src-test', 'chap_0001', tempDir)
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  describe('getCacheDir', () => {
    it('deve retornar o path do diretório de cache', () => {
      const dir = service.getCacheDir()
      expect(dir).toBe(join(tempDir, 'sources', 'src-test', 'chapters', 'chap_0001'))
    })
  })

  describe('getCachedPath', () => {
    it('deve retornar path com padding de 4 dígitos', () => {
      const path = service.getCachedPath(5)
      expect(path).toContain('0005')
    })
  })

  describe('isCached', () => {
    it('deve retornar false quando diretório não existe', async () => {
      const result = await service.isCached()
      expect(result).toBe(false)
    })

    it('deve retornar false quando diretório existe mas não tem imagens', async () => {
      await service.writeManifest({ totalImages: 3, urls: ['url1', 'url2', 'url3'] })
      const result = await service.isCached()
      expect(result).toBe(false)
    })

    it('deve retornar true quando diretório existe e tem imagens', async () => {
      const cacheDir = service.getCacheDir()
      const { mkdirp } = await import('../../../../shared/utils/filesystem')
      await mkdirp(cacheDir)
      await writeFile(join(cacheDir, '0001.jpg'), Buffer.from([0xff, 0xd8, 0xff]))
      const result = await service.isCached()
      expect(result).toBe(true)
    })
  })

  describe('writeManifest / readManifest', () => {
    it('deve escrever e ler manifest corretamente', async () => {
      const manifest: ChapterManifest = { totalImages: 5, urls: ['http://a.com/1.jpg', 'http://a.com/2.jpg'] }
      await service.writeManifest(manifest)
      const result = await service.readManifest()
      expect(result).toEqual(manifest)
    })

    it('deve retornar null quando manifest não existe', async () => {
      const result = await service.readManifest()
      expect(result).toBeNull()
    })
  })

  describe('getImageUrls', () => {
    it('deve delegar para provider.getChapterImages', async () => {
      const urls = ['http://test.com/img1.jpg', 'http://test.com/img2.jpg']
      ;(provider.getChapterImages as any).mockResolvedValue(urls)

      const result = await service.getImageUrls('http://test.com/chapter/1')

      expect(result).toEqual(urls)
      expect(provider.getChapterImages).toHaveBeenCalledWith('http://test.com/chapter/1')
    })
  })

  describe('downloadAll', () => {
    it('deve baixar todas as imagens e salvar no cache', async () => {
      const urls = ['http://test.com/1.jpg', 'http://test.com/2.jpg']
      ;(provider.downloadImage as any)
        .mockResolvedValueOnce({ buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0]), contentType: 'image/jpeg' })
        .mockResolvedValueOnce({ buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]), contentType: 'image/png' })

      const result = await service.downloadAll(urls)

      expect(result.downloaded).toBe(2)
      expect(result.errors).toBe(0)
      expect(await service.isCached()).toBe(true)
    })

    it('deve contar erros quando download falha', async () => {
      const urls = ['http://test.com/1.jpg', 'http://test.com/2.jpg']
      ;(provider.downloadImage as any)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0]), contentType: 'image/jpeg' })

      const result = await service.downloadAll(urls)

      expect(result.downloaded).toBe(1)
      expect(result.errors).toBe(1)
    })

    it('deve validar magic bytes e rejeitar buffers inválidos', async () => {
      const urls = ['http://test.com/1.jpg']
      ;(provider.downloadImage as any).mockResolvedValueOnce({
        buffer: Buffer.from('not an image'),
        contentType: 'image/jpeg',
      })

      const result = await service.downloadAll(urls)

      expect(result.downloaded).toBe(0)
      expect(result.errors).toBe(1)
    })
  })
})
