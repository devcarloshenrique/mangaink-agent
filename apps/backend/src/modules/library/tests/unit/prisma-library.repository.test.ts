import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PrismaLibraryRepository } from '../../repositories/prisma-library.repository'

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    userLibrary: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}))

vi.mock('../../../../shared/database/prisma', () => ({
  getPrisma: () => prismaMock,
}))


describe('PrismaLibraryRepository', () => {
  let repo: PrismaLibraryRepository

  beforeEach(() => {
    vi.clearAllMocks()
    repo = new PrismaLibraryRepository()
  })

  it('listByUser: mapeia corretamente metadados da source, capítulos e capa', async () => {
    const now = new Date()
    prismaMock.userLibrary.findMany.mockResolvedValue([
      {
        id: '00000000-0000-4000-8000-000000000001',
        userId: 'u1',
        sourceId: 'src-1',
        isFavorite: true,
        createdAt: now,
        updatedAt: now,
        source: {
          sourceId: 'src-1',
          metadata: {
            title: 'Berserk',
            author: 'Kentaro Miura',
          },
          covers: [
            { type: 'original', imageUrl: 'https://img.com/berserk.jpg' },
          ],
          _count: {
            chapters: 364,
          },
        },
      },
    ])

    const result = await repo.listByUser('u1')

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      id: '00000000-0000-4000-8000-000000000001',
      userId: 'u1',
      sourceId: 'src-1',
      title: 'Berserk',
      author: 'Kentaro Miura',
      coverUrl: 'https://img.com/berserk.jpg',
      chaptersCount: 364,
      isFavorite: true,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    })
  })

  it('add: realiza upsert de userLibrary', async () => {
    const now = new Date()
    prismaMock.userLibrary.upsert.mockResolvedValue({
      id: '00000000-0000-4000-8000-000000000001',
      userId: 'u1',
      sourceId: 'src-1',
      isFavorite: false,
      createdAt: now,
      updatedAt: now,
    })

    const res = await repo.add('u1', 'src-1')
    expect(res.sourceId).toBe('src-1')
    expect(prismaMock.userLibrary.upsert).toHaveBeenCalledWith({
      where: {
        userId_sourceId: { userId: 'u1', sourceId: 'src-1' },
      },
      create: {
        userId: 'u1',
        sourceId: 'src-1',
        isFavorite: false,
      },
      update: {},
    })
  })

  it('remove: deleta o registro em userLibrary', async () => {
    prismaMock.userLibrary.deleteMany.mockResolvedValue({ count: 1 })
    await repo.remove('u1', 'src-1')
    expect(prismaMock.userLibrary.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: 'u1',
        sourceId: 'src-1',
      },
    })
  })

  it('setFavorite: atualiza a flag isFavorite', async () => {
    const now = new Date()
    prismaMock.userLibrary.upsert.mockResolvedValue({
      id: '00000000-0000-4000-8000-000000000001',
      userId: 'u1',
      sourceId: 'src-1',
      isFavorite: true,
      createdAt: now,
      updatedAt: now,
    })

    const res = await repo.setFavorite('u1', 'src-1', true)
    expect(res.isFavorite).toBe(true)
    expect(prismaMock.userLibrary.upsert).toHaveBeenCalledWith({
      where: {
        userId_sourceId: { userId: 'u1', sourceId: 'src-1' },
      },
      create: {
        userId: 'u1',
        sourceId: 'src-1',
        isFavorite: true,
      },
      update: {
        isFavorite: true,
      },
    })
  })
})
