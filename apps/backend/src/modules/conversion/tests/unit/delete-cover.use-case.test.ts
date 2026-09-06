import { describe, it, expect, vi, beforeEach } from 'vitest'
import { join } from 'node:path'

const hoisted = vi.hoisted(() => {
  const testStoragePath = '/tmp/mangaink-test-storage-delete-cover'
  return { testStoragePath }
})

vi.mock('../../../../shared/config/env', () => ({
  env: {
    STORAGE_PATH: hoisted.testStoragePath,
  },
}))

vi.mock('../../../../shared/utils/filesystem', () => ({
  pathExists: vi.fn(),
}))

vi.mock('../../../../shared/database/prisma', () => ({
  getPrisma: vi.fn(),
}))

vi.mock('node:fs/promises', () => ({
  unlink: vi.fn(),
  readdir: vi.fn(),
}))

import { unlink, readdir } from 'node:fs/promises'
import { pathExists } from '../../../../shared/utils/filesystem'
import { getPrisma } from '../../../../shared/database/prisma'
import { DeleteCoverUseCase } from '../../use-cases/delete-cover.use-case'
import {
  ConversionNotFoundError,
  InvalidConversionStateError,
} from '../../errors/conversion.errors'

describe('DeleteCoverUseCase (Unit)', () => {
  let useCase: DeleteCoverUseCase
  const OWNER_ID = 'user-owner-001'
  const OTHER_ID = 'user-other-002'
  const mockPrismaCoverFindUnique = vi.fn()
  const mockPrismaCoverFindFirst = vi.fn()
  const mockPrismaCoverDelete = vi.fn()
  const mockPrismaCoverDeleteMany = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getPrisma).mockReturnValue({
      cover: {
        findUnique: mockPrismaCoverFindUnique,
        findFirst: mockPrismaCoverFindFirst,
        delete: mockPrismaCoverDelete,
        deleteMany: mockPrismaCoverDeleteMany,
      },
    } as any)
    useCase = new DeleteCoverUseCase()
  })
  it('deve excluir capa do tipo upload com sucesso quando encontrada no Prisma com sourceId', async () => {
    const coverRecord = {
      id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      coverId: 'up_cover_123',
      sourceId: 'src_manga_abc',
      type: 'upload',
      userId: OWNER_ID,
      label: 'Volume 1 Custom',
      imageUrl: '/api/conversions/covers/uploaded/up_cover_123',
    }
    mockPrismaCoverFindFirst.mockResolvedValueOnce(coverRecord)
    mockPrismaCoverDeleteMany.mockResolvedValueOnce({ count: 1 })

    const uploadsDir = join(hoisted.testStoragePath, 'uploads', 'covers')
    const sourceDir = join(hoisted.testStoragePath, 'sources', 'src_manga_abc', 'covers')

    vi.mocked(pathExists).mockImplementation(async (p: string) => {
      if (p === uploadsDir || p === sourceDir) return true
      return false
    })

    vi.mocked(readdir).mockImplementation(async (p: string) => {
      if (p === uploadsDir) return ['up_cover_123.jpg', 'other.png'] as any
      if (p === sourceDir) return ['up_cover_123.jpg'] as any
      return [] as any
    })
    const result = await useCase.execute('up_cover_123', OWNER_ID)

    expect(result).toEqual({
      success: true,
      message: 'Capa excluída com sucesso.',
    })

    expect(mockPrismaCoverDeleteMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { coverId: 'up_cover_123' },
          { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' },
        ],
      },
    })

    expect(unlink).toHaveBeenCalledWith(join(uploadsDir, 'up_cover_123.jpg'))
    expect(unlink).toHaveBeenCalledWith(join(sourceDir, 'up_cover_123.jpg'))
  })

  it('deve excluir capa quando consultada pelo UUID da chave primária', async () => {
    const validUuid = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
    const coverRecord = {
      id: validUuid,
      coverId: 'up_cover_uuid_ref',
      sourceId: 'src_manga_abc',
      type: 'upload',
      userId: OWNER_ID,
      label: 'Volume 1 Custom',
      imageUrl: '/api/conversions/covers/uploaded/up_cover_uuid_ref',
    }
    mockPrismaCoverFindFirst.mockResolvedValueOnce(coverRecord)
    mockPrismaCoverDeleteMany.mockResolvedValueOnce({ count: 1 })

    const uploadsDir = join(hoisted.testStoragePath, 'uploads', 'covers')
    vi.mocked(pathExists).mockImplementation(async (p: string) => {
      if (p === uploadsDir) return true
      return false
    })

    vi.mocked(readdir).mockImplementation(async (p: string) => {
      if (p === uploadsDir) return ['up_cover_uuid_ref.jpg'] as any
      return [] as any
    })

    const result = await useCase.execute(validUuid, OWNER_ID)

    expect(result).toEqual({
      success: true,
      message: 'Capa excluída com sucesso.',
    })

    expect(mockPrismaCoverFindFirst).toHaveBeenCalledWith({
      where: {
        OR: [
          { coverId: validUuid },
          { id: validUuid },
        ],
      },
    })
  })

  it('deve excluir capa do tipo upload mesmo sem registro no Prisma se o arquivo físico existir no disco', async () => {
    mockPrismaCoverFindFirst.mockResolvedValueOnce(null)

    const uploadsDir = join(hoisted.testStoragePath, 'uploads', 'covers')
    vi.mocked(pathExists).mockImplementation(async (p: string) => {
      if (p === uploadsDir) return true
      return false
    })

    vi.mocked(readdir).mockImplementation(async (p: string) => {
      if (p === uploadsDir) return ['up_unlinked_456.webp'] as any
      return [] as any
    })

    const result = await useCase.execute('up_unlinked_456', OWNER_ID)

    expect(result).toEqual({
      success: true,
      message: 'Capa excluída com sucesso.',
    })

    expect(unlink).toHaveBeenCalledWith(join(uploadsDir, 'up_unlinked_456.webp'))
  })

  it('deve lançar InvalidConversionStateError se o tipo da capa não for upload', async () => {
    const originalCover = {
      id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      coverId: 'cover_orig_001',
      sourceId: 'src_manga_abc',
      type: 'original',
      label: 'Capa Oficial',
      imageUrl: 'https://cdn.example.com/cover.jpg',
    }
    mockPrismaCoverFindFirst.mockResolvedValueOnce(originalCover)

    await expect(useCase.execute('cover_orig_001', OWNER_ID)).rejects.toThrow(
      new InvalidConversionStateError('Apenas capas personalizadas (upload) podem ser excluídas.'),
    )

    expect(mockPrismaCoverDeleteMany).not.toHaveBeenCalled()
    expect(unlink).not.toHaveBeenCalled()
  })

  it('deve lançar ConversionNotFoundError se capa não existir no Prisma nem no disco', async () => {
    mockPrismaCoverFindFirst.mockResolvedValueOnce(null)

    const uploadsDir = join(hoisted.testStoragePath, 'uploads', 'covers')
    vi.mocked(pathExists).mockImplementation(async (p: string) => {
      if (p === uploadsDir) return true
      return false
    })

    vi.mocked(readdir).mockImplementation(async () => ['other-file.jpg'] as any)

    await expect(useCase.execute('up_non_existent', OWNER_ID)).rejects.toThrow(
      new ConversionNotFoundError('Capa não encontrada.'),
    )

    expect(mockPrismaCoverDeleteMany).not.toHaveBeenCalled()
    expect(unlink).not.toHaveBeenCalled()
  })

  it('deve lançar ConversionNotFoundError ao deletar capa de outro usuário (sem vazar existência)', async () => {
    mockPrismaCoverFindFirst.mockResolvedValueOnce({
      id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      coverId: 'up_cover_alheia',
      sourceId: 'src_manga_abc',
      type: 'upload',
      userId: OWNER_ID,
      label: 'Capa de outro usuário',
      imageUrl: '/api/conversions/covers/uploaded/up_cover_alheia',
    })

    await expect(useCase.execute('up_cover_alheia', OTHER_ID)).rejects.toThrow(
      new ConversionNotFoundError('Capa não encontrada.'),
    )

    expect(mockPrismaCoverDeleteMany).not.toHaveBeenCalled()
    expect(unlink).not.toHaveBeenCalled()
  })

  it('deve excluir capa legada sem dono (userId NULL) mantendo compatibilidade', async () => {
    mockPrismaCoverFindFirst.mockResolvedValueOnce({
      id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
      coverId: 'up_cover_legada',
      sourceId: 'src_manga_abc',
      type: 'upload',
      userId: null,
      label: 'Capa legada',
      imageUrl: '/api/conversions/covers/uploaded/up_cover_legada',
    })
    mockPrismaCoverDeleteMany.mockResolvedValueOnce({ count: 1 })

    const uploadsDir = join(hoisted.testStoragePath, 'uploads', 'covers')
    vi.mocked(pathExists).mockImplementation(async (p: string) => {
      if (p === uploadsDir) return true
      return false
    })
    vi.mocked(readdir).mockImplementation(async () => [] as unknown as string[])

    const result = await useCase.execute('up_cover_legada', OTHER_ID)

    expect(result).toEqual({
      success: true,
      message: 'Capa excluída com sucesso.',
    })
    expect(mockPrismaCoverDeleteMany).toHaveBeenCalled()
  })
})
