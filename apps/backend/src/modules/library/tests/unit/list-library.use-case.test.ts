import { describe, it, expect, beforeEach } from 'vitest'
import { ListLibraryUseCase } from '../../use-cases/list-library.use-case'
import { InMemoryLibraryRepository } from '../helpers/in-memory-library.repository'


describe('ListLibraryUseCase', () => {
  let libraryRepo: InMemoryLibraryRepository

  beforeEach(() => {
    libraryRepo = new InMemoryLibraryRepository()
  })

  it('deve listar as obras do usuário autenticado', async () => {
    const now = new Date()
    libraryRepo.records = [
      {
        id: '00000000-0000-4000-8000-000000000001',
        userId: 'user-1',
        sourceId: 'src-1',
        title: 'One Piece',
        author: 'Eiichiro Oda',
        coverUrl: 'https://example.com/op.jpg',
        chaptersCount: 1100,
        isFavorite: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: '00000000-0000-4000-8000-000000000002',
        userId: 'user-1',
        sourceId: 'src-2',
        title: 'Naruto',
        author: 'Masashi Kishimoto',
        coverUrl: 'https://example.com/naruto.jpg',
        chaptersCount: 700,
        isFavorite: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: '00000000-0000-4000-8000-000000000003',
        userId: 'user-2',
        sourceId: 'src-3',
        title: 'Bleach',
        author: 'Tite Kubo',
        coverUrl: 'https://example.com/bleach.jpg',
        chaptersCount: 686,
        isFavorite: true,
        createdAt: now,
        updatedAt: now,
      },
    ]

    const useCase = new ListLibraryUseCase(libraryRepo)
    const result = await useCase.execute({ userId: 'user-1' })

    expect(result.total).toBe(2)
    expect(result.items).toHaveLength(2)
    expect(result.items.map((i) => i.title)).toEqual(['One Piece', 'Naruto'])
  })

  it('deve filtrar por isFavorite', async () => {
    const now = new Date()
    libraryRepo.records = [
      {
        id: '00000000-0000-4000-8000-000000000001',
        userId: 'user-1',
        sourceId: 'src-1',
        title: 'One Piece',
        author: 'Eiichiro Oda',
        coverUrl: 'https://example.com/op.jpg',
        chaptersCount: 1100,
        isFavorite: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: '00000000-0000-4000-8000-000000000002',
        userId: 'user-1',
        sourceId: 'src-2',
        title: 'Naruto',
        author: 'Masashi Kishimoto',
        coverUrl: 'https://example.com/naruto.jpg',
        chaptersCount: 700,
        isFavorite: false,
        createdAt: now,
        updatedAt: now,
      },
    ]

    const useCase = new ListLibraryUseCase(libraryRepo)
    const result = await useCase.execute({ userId: 'user-1', isFavorite: true })

    expect(result.total).toBe(1)
    expect(result.items[0].title).toBe('One Piece')
  })

  it('deve filtrar por query (título ou autor)', async () => {
    const now = new Date()
    libraryRepo.records = [
      {
        id: '00000000-0000-4000-8000-000000000001',
        userId: 'user-1',
        sourceId: 'src-1',
        title: 'One Piece',
        author: 'Eiichiro Oda',
        coverUrl: 'https://example.com/op.jpg',
        chaptersCount: 1100,
        isFavorite: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: '00000000-0000-4000-8000-000000000002',
        userId: 'user-1',
        sourceId: 'src-2',
        title: 'Naruto',
        author: 'Masashi Kishimoto',
        coverUrl: 'https://example.com/naruto.jpg',
        chaptersCount: 700,
        isFavorite: false,
        createdAt: now,
        updatedAt: now,
      },
    ]

    const useCase = new ListLibraryUseCase(libraryRepo)
    const result = await useCase.execute({ userId: 'user-1', query: 'kishimoto' })

    expect(result.total).toBe(1)
    expect(result.items[0].title).toBe('Naruto')
  })
})
