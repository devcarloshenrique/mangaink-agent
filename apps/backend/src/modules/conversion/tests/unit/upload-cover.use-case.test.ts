import { describe, it, expect, vi, beforeEach } from 'vitest'
import { join } from 'node:path'

const hoisted = vi.hoisted(() => {
  const testStoragePath = '/tmp/mangaink-test-storage-upload'
  const validJpgBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46])
  const validPngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const validWebpBuffer = Buffer.concat([
    Buffer.from('RIFF'),
    Buffer.from([0x00, 0x00, 0x00, 0x00]),
    Buffer.from('WEBPVP8 '),
    Buffer.from([0x00, 0x00, 0x00, 0x00]),
  ])
  return { testStoragePath, validJpgBuffer, validPngBuffer, validWebpBuffer }
})

vi.mock('../../../../shared/config/env', () => ({
  env: {
    STORAGE_PATH: hoisted.testStoragePath,
  },
}))

vi.mock('../../../../shared/utils/filesystem', () => ({
  mkdirp: vi.fn(),
  pathExists: vi.fn(),
}))

vi.mock('../../../../shared/database/prisma', () => ({
  getPrisma: vi.fn(),
}))

vi.mock('../../../../shared/database/repositories', () => ({
  getSourceRepository: vi.fn(),
}))

vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn(),
  unlink: vi.fn(),
  readdir: vi.fn(),
}))

import { writeFile, unlink } from 'node:fs/promises'
import { mkdirp } from '../../../../shared/utils/filesystem'
import { getPrisma } from '../../../../shared/database/prisma'
import { getSourceRepository } from '../../../../shared/database/repositories'
import { UploadCoverUseCase } from '../../use-cases/upload-cover.use-case'
import { ValidationError, SourceNotFoundError } from '../../errors/conversion.errors'
import { InvalidImageContentError } from '../../../../shared/utils/image-validation'

describe('UploadCoverUseCase (Unit)', () => {
  let useCase: UploadCoverUseCase
  const mockPrismaCoverCreate = vi.fn()
  const mockSourceRepoLoad = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getPrisma).mockReturnValue({
      cover: {
        create: mockPrismaCoverCreate,
      },
    } as any)
    vi.mocked(getSourceRepository).mockReturnValue({
      load: mockSourceRepoLoad,
    } as any)
    useCase = new UploadCoverUseCase()
  })

  it('deve fazer upload de uma imagem JPEG válida em base64 e salvar no disco', async () => {
    const base64Data = `data:image/jpeg;base64,${hoisted.validJpgBuffer.toString('base64')}`
    const result = await useCase.execute({
      fileName: 'my-cover.jpg',
      contentType: 'image/jpeg',
      base64Data,
    })

    expect(result.uploadId).toBeDefined()
    expect(result.uploadId).toMatch(/^up_/)
    expect(result.name).toBe('my-cover.jpg')
    expect(result.url).toBe(`/api/conversions/covers/uploaded/${result.uploadId}`)

    const expectedUploadsDir = join(hoisted.testStoragePath, 'uploads', 'covers')
    expect(mkdirp).toHaveBeenCalledWith(expectedUploadsDir)
    expect(writeFile).toHaveBeenCalledWith(
      join(expectedUploadsDir, `${result.uploadId}.jpg`),
      hoisted.validJpgBuffer,
    )
  })

  it('deve aceitar base64 puro (sem prefixo data:image/...)', async () => {
    const base64Data = hoisted.validPngBuffer.toString('base64')
    const result = await useCase.execute({
      fileName: 'cover.png',
      contentType: 'image/png',
      base64Data,
    })

    expect(result.uploadId).toBeDefined()
    expect(result.name).toBe('cover.png')
    expect(writeFile).toHaveBeenCalledWith(
      join(hoisted.testStoragePath, 'uploads', 'covers', `${result.uploadId}.png`),
      hoisted.validPngBuffer,
    )
  })

  it('deve aceitar imagem WEBP', async () => {
    const base64Data = hoisted.validWebpBuffer.toString('base64')
    const result = await useCase.execute({
      fileName: 'cover.webp',
      contentType: 'image/webp',
      base64Data,
    })

    expect(result.uploadId).toBeDefined()
    expect(writeFile).toHaveBeenCalledWith(
      join(hoisted.testStoragePath, 'uploads', 'covers', `${result.uploadId}.webp`),
      hoisted.validWebpBuffer,
    )
  })

  it('deve rejeitar arquivo maior que 15MB', async () => {
    const fifteenMbAndOne = 15 * 1024 * 1024 + 1
    const bigBuffer = Buffer.alloc(fifteenMbAndOne)
    // magic bytes PNG no inicio
    hoisted.validPngBuffer.copy(bigBuffer)

    const base64Data = bigBuffer.toString('base64')

    await expect(
      useCase.execute({
        fileName: 'huge.png',
        contentType: 'image/png',
        base64Data,
      }),
    ).rejects.toThrow(ValidationError)
  })

  it('deve rejeitar arquivo com conteúdo inválido (magic bytes inválidos)', async () => {
    const fakeText = Buffer.from('<html><body>Hello</body></html>')
    const base64Data = fakeText.toString('base64')

    await expect(
      useCase.execute({
        fileName: 'fake.png',
        contentType: 'image/png',
        base64Data,
      }),
    ).rejects.toThrow(InvalidImageContentError)
  })

  it('deve rejeitar base64 mal formatado', async () => {
    await expect(
      useCase.execute({
        fileName: 'invalid.jpg',
        contentType: 'image/jpeg',
        base64Data: 'data:image/jpeg;base64,!!!invalid-base64-content@@@',
      }),
    ).rejects.toThrow()
  })

  describe('com sourceId fornecido', () => {
    it('deve lançar SourceNotFoundError se a source não existir no banco/repositório', async () => {
      mockSourceRepoLoad.mockResolvedValueOnce(null)

      const base64Data = `data:image/jpeg;base64,${hoisted.validJpgBuffer.toString('base64')}`

      await expect(
        useCase.execute({
          sourceId: 'src_inexistente',
          fileName: 'custom.jpg',
          contentType: 'image/jpeg',
          base64Data,
        }),
      ).rejects.toThrow(SourceNotFoundError)

      expect(mockSourceRepoLoad).toHaveBeenCalledWith('src_inexistente')
      expect(mockPrismaCoverCreate).not.toHaveBeenCalled()
    })

    it('deve persistir na tabela covers do Prisma e salvar em storage/sources/{sourceId}/covers/{uploadId}.ext', async () => {
      mockSourceRepoLoad.mockResolvedValueOnce({
        sourceId: 'src_valid_123',
        covers: [],
      })

      const base64Data = `data:image/jpeg;base64,${hoisted.validJpgBuffer.toString('base64')}`
      const result = await useCase.execute({
        sourceId: 'src_valid_123',
        label: 'Meu Volume 1',
        fileName: 'custom-cover.jpg',
        contentType: 'image/jpeg',
        base64Data,
      })

      expect(result.uploadId).toBeDefined()
      expect(result.uploadId).toMatch(/^up_/)
      expect(result.sourceId).toBe('src_valid_123')
      expect(result.coverId).toBe(result.uploadId)
      expect(result.name).toBe('custom-cover.jpg')
      expect(result.url).toBe(`/api/conversions/covers/uploaded/${result.uploadId}`)

      // Verifica criação no Prisma
      expect(mockPrismaCoverCreate).toHaveBeenCalledWith({
        data: {
          coverId: result.uploadId,
          sourceId: 'src_valid_123',
          type: 'upload',
          label: 'Meu Volume 1',
          imageUrl: `/api/conversions/covers/uploaded/${result.uploadId}`,
        },
      })

      // Verifica escrita nos dois diretórios (uploads/covers e sources/{sourceId}/covers)
      const uploadsDir = join(hoisted.testStoragePath, 'uploads', 'covers')
      const sourceCoversDir = join(hoisted.testStoragePath, 'sources', 'src_valid_123', 'covers')

      expect(mkdirp).toHaveBeenCalledWith(uploadsDir)
      expect(mkdirp).toHaveBeenCalledWith(sourceCoversDir)

      expect(writeFile).toHaveBeenCalledWith(
        join(uploadsDir, `${result.uploadId}.jpg`),
        hoisted.validJpgBuffer,
      )
      expect(writeFile).toHaveBeenCalledWith(
        join(sourceCoversDir, `${result.uploadId}.jpg`),
        hoisted.validJpgBuffer,
      )
    })

    it('deve persistir o userId do uploader quando informado', async () => {
      mockSourceRepoLoad.mockResolvedValueOnce({
        sourceId: 'src_valid_123',
        covers: [],
      })

      const base64Data = `data:image/jpeg;base64,${hoisted.validJpgBuffer.toString('base64')}`
      const result = await useCase.execute(
        {
          sourceId: 'src_valid_123',
          fileName: 'custom-cover.jpg',
          contentType: 'image/jpeg',
          base64Data,
        },
        'user-uploader-001',
      )

      expect(mockPrismaCoverCreate).toHaveBeenCalledWith({
        data: {
          coverId: result.uploadId,
          sourceId: 'src_valid_123',
          type: 'upload',
          label: 'custom-cover.jpg',
          imageUrl: `/api/conversions/covers/uploaded/${result.uploadId}`,
          userId: 'user-uploader-001',
        },
      })
    })
    it('deve usar fileName como fallback se label não for fornecido ou for vazio', async () => {
      mockSourceRepoLoad.mockResolvedValueOnce({
        sourceId: 'src_valid_123',
        covers: [],
      })

      const base64Data = hoisted.validPngBuffer.toString('base64')
      const result = await useCase.execute({
        sourceId: 'src_valid_123',
        label: '   ',
        fileName: 'minha-capa.png',
        contentType: 'image/png',
        base64Data,
      })

      expect(mockPrismaCoverCreate).toHaveBeenCalledWith({
        data: {
          coverId: result.uploadId,
          sourceId: 'src_valid_123',
          type: 'upload',
          label: 'minha-capa.png',
          imageUrl: `/api/conversions/covers/uploaded/${result.uploadId}`,
        },
      })
    })

    it('deve apagar os arquivos escritos se o create no banco falhar', async () => {
      mockSourceRepoLoad.mockResolvedValueOnce({
        sourceId: 'src_valid_123',
        covers: [],
      })
      mockPrismaCoverCreate.mockRejectedValueOnce(new Error('DB indisponível'))

      const base64Data = `data:image/jpeg;base64,${hoisted.validJpgBuffer.toString('base64')}`

      await expect(
        useCase.execute({
          sourceId: 'src_valid_123',
          fileName: 'custom-cover.jpg',
          contentType: 'image/jpeg',
          base64Data,
        }),
      ).rejects.toThrow('DB indisponível')

      // Ambos os arquivos (uploads/covers e sources/{sourceId}/covers) removidos
      expect(unlink).toHaveBeenCalledTimes(2)
      const removed = vi.mocked(unlink).mock.calls.map(([p]) => String(p))
      expect(removed.some((p) => p.includes(join('uploads', 'covers')))).toBe(true)
      expect(removed.some((p) => p.includes(join('sources', 'src_valid_123', 'covers')))).toBe(true)
    })
  })
})
