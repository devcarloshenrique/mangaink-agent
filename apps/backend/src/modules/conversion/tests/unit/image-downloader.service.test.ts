import { describe, it, expect, vi } from 'vitest'
import { join } from 'node:path'

const mockReadJson = vi.fn()
const mockWriteJson = vi.fn()
const mockPathExists = vi.fn()

vi.mock('../../../../shared/utils/filesystem', () => ({
  writeJson: (...args: any[]) => mockWriteJson(...args),
  readJson: (...args: any[]) => mockReadJson(...args),
  pathExists: (...args: any[]) => mockPathExists(...args),
}))

import {
  readChapterImagesMeta,
  writeChapterImagesMeta,
} from '../../services/image-downloader.service'

const chapterDir = join('/test/storage', 'sources', 'src-test', 'chapters', 'chap_0001')
const imagesJsonPath = join(chapterDir, 'images.json')

describe('readChapterImagesMeta', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('retorna null quando images.json não existe', async () => {
    mockPathExists.mockResolvedValue(false)
    const result = await readChapterImagesMeta(chapterDir)
    expect(result).toBeNull()
  })

  it('retorna placeholderPageIndices quando arquivo existe', async () => {
    mockPathExists.mockResolvedValue(true)
    mockReadJson.mockResolvedValue({ placeholderPageIndices: [20, 39] })
    const result = await readChapterImagesMeta(chapterDir)
    expect(result).toEqual({ placeholderPageIndices: [20, 39] })
  })

  it('retorna null para JSON inválido', async () => {
    mockPathExists.mockResolvedValue(true)
    mockReadJson.mockRejectedValue(new Error('parse error'))
    const result = await readChapterImagesMeta(chapterDir)
    expect(result).toBeNull()
  })
})

describe('writeChapterImagesMeta', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('escreve JSON com placeholderPageIndices', async () => {
    await writeChapterImagesMeta(chapterDir, { placeholderPageIndices: [5, 10] })
    expect(mockWriteJson).toHaveBeenCalledWith(imagesJsonPath, { placeholderPageIndices: [5, 10] })
  })
})
