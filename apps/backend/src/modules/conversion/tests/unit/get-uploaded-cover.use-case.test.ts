import { describe, it, expect, vi, beforeEach } from 'vitest'
import { join } from 'node:path'

const hoisted = vi.hoisted(() => {
  const testStoragePath = '/tmp/mangaink-test-storage-get-cover'
  const validJpgBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46])
  return { testStoragePath, validJpgBuffer }
})

vi.mock('../../../../shared/config/env', () => ({
  env: {
    STORAGE_PATH: hoisted.testStoragePath,
  },
}))

vi.mock('../../../../shared/utils/filesystem', () => ({
  pathExists: vi.fn(),
}))

vi.mock('node:fs/promises', () => ({
  readdir: vi.fn(),
  readFile: vi.fn(),
}))

import { readdir, readFile } from 'node:fs/promises'
import { pathExists } from '../../../../shared/utils/filesystem'
import { GetUploadedCoverUseCase } from '../../use-cases/get-uploaded-cover.use-case'
import { ConversionNotFoundError } from '../../errors/conversion.errors'

describe('GetUploadedCoverUseCase (Unit)', () => {
  let useCase: GetUploadedCoverUseCase

  beforeEach(() => {
    vi.clearAllMocks()
    useCase = new GetUploadedCoverUseCase()
  })

  it('deve retornar filePath e contentType quando o arquivo existir diretamente com extensão', async () => {
    const uploadId = 'up_abc123'
    const expectedFilePath = join(hoisted.testStoragePath, 'uploads', 'covers', 'up_abc123.jpg')

    vi.mocked(pathExists).mockImplementation(async (p) => {
      if (p === expectedFilePath) return true
      return false
    })

    const result = await useCase.execute(uploadId)

    expect(result.filePath).toBe(expectedFilePath)
    expect(result.contentType).toBe('image/jpeg')
  })

  it('deve procurar via readdir quando o caminho exato não bater de primeira', async () => {
    const uploadId = 'up_xyz987'
    const uploadsDir = join(hoisted.testStoragePath, 'uploads', 'covers')
    const fileName = 'up_xyz987.png'
    const expectedFilePath = join(uploadsDir, fileName)

    vi.mocked(pathExists).mockImplementation(async (p) => {
      if (p === uploadsDir) return true
      return false
    })
    vi.mocked(readdir).mockResolvedValue([fileName] as any)

    const result = await useCase.execute(uploadId)

    expect(result.filePath).toBe(expectedFilePath)
    expect(result.contentType).toBe('image/png')
  })

  it('deve lançar ConversionNotFoundError se o arquivo não existir', async () => {
    vi.mocked(pathExists).mockResolvedValue(false)
    vi.mocked(readdir).mockResolvedValue([] as any)

    await expect(useCase.execute('up_missing')).rejects.toThrow(ConversionNotFoundError)
  })
})
