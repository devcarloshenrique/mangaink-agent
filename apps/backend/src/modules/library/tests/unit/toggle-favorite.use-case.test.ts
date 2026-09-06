import { describe, it, expect, beforeEach } from 'vitest'
import { ToggleFavoriteUseCase } from '../../use-cases/toggle-favorite.use-case'
import { InMemoryLibraryRepository } from '../helpers/in-memory-library.repository'
import { SourceNotFoundError } from '../../../scraping/errors/scraping.errors'
import type { SourceCacheRepository } from '../../../scraping/repositories/source-cache.repository'


describe('ToggleFavoriteUseCase', () => {
  let libraryRepo: InMemoryLibraryRepository
  let mockSourceRepo: SourceCacheRepository

  beforeEach(() => {
    libraryRepo = new InMemoryLibraryRepository()
    mockSourceRepo = {
      exists: async (sourceId: string) => sourceId === 'src-1',
      load: async () => null,
      save: async () => {},
      update: async () => {},
      delete: async () => {},
      getPlaceholderIndices: async () => [],
      updatePlaceholderIndices: async () => {},
      updateChapterUnavailableReason: async () => {},
    }
  })

  it('deve alternar favorito quando isFavorite for omitido', async () => {
    await libraryRepo.add('user-1', 'src-1')
    const useCase = new ToggleFavoriteUseCase(libraryRepo, mockSourceRepo)

    const res1 = await useCase.execute({ userId: 'user-1', sourceId: 'src-1' })
    expect(res1.isFavorite).toBe(true)

    const res2 = await useCase.execute({ userId: 'user-1', sourceId: 'src-1' })
    expect(res2.isFavorite).toBe(false)
  })

  it('deve definir explicitamente isFavorite quando passado', async () => {
    await libraryRepo.add('user-1', 'src-1')
    const useCase = new ToggleFavoriteUseCase(libraryRepo, mockSourceRepo)

    const res1 = await useCase.execute({ userId: 'user-1', sourceId: 'src-1', isFavorite: true })
    expect(res1.isFavorite).toBe(true)

    const res2 = await useCase.execute({ userId: 'user-1', sourceId: 'src-1', isFavorite: true })
    expect(res2.isFavorite).toBe(true)
  })

  it('deve criar o registro de user_library se não existir ao favoritar, desde que a source exista', async () => {
    const useCase = new ToggleFavoriteUseCase(libraryRepo, mockSourceRepo)
    const res = await useCase.execute({ userId: 'user-1', sourceId: 'src-1', isFavorite: true })
    expect(res.isFavorite).toBe(true)
    expect(libraryRepo.records.length).toBe(1)
  })

  it('deve lançar SourceNotFoundError se a source não existir', async () => {
    const useCase = new ToggleFavoriteUseCase(libraryRepo, mockSourceRepo)
    await expect(
      useCase.execute({ userId: 'user-1', sourceId: 'src-invalid', isFavorite: true }),
    ).rejects.toThrow(SourceNotFoundError)
  })
})
