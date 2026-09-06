import { describe, it, expect, beforeEach } from 'vitest'
import { AddToLibraryUseCase } from '../../use-cases/add-to-library.use-case'
import { InMemoryLibraryRepository } from '../helpers/in-memory-library.repository'
import { SourceNotFoundError } from '../../../scraping/errors/scraping.errors'
import type { SourceCacheRepository } from '../../../scraping/repositories/source-cache.repository'




describe('AddToLibraryUseCase', () => {
  let libraryRepo: InMemoryLibraryRepository
  let mockSourceRepo: SourceCacheRepository

  beforeEach(() => {
    libraryRepo = new InMemoryLibraryRepository()
    mockSourceRepo = {
      exists: async (sourceId: string) => sourceId === 'src-valid',
      load: async () => null,
      save: async () => {},
      update: async () => {},
      delete: async () => {},
      getPlaceholderIndices: async () => [],
      updatePlaceholderIndices: async () => {},
      updateChapterUnavailableReason: async () => {},
    }
  })

  it('deve adicionar uma obra válida à biblioteca do usuário', async () => {
    const useCase = new AddToLibraryUseCase(libraryRepo, mockSourceRepo)
    const result = await useCase.execute({
      userId: '00000000-0000-4000-8000-000000000001',
      sourceId: 'src-valid',
    })

    expect(result).toMatchObject({
      userId: '00000000-0000-4000-8000-000000000001',
      sourceId: 'src-valid',
      isFavorite: false,
    })
    expect(result.id).toBeDefined()
  })

  it('deve lançar SourceNotFoundError quando a source não existir no banco', async () => {
    const useCase = new AddToLibraryUseCase(libraryRepo, mockSourceRepo)
    await expect(
      useCase.execute({
        userId: '00000000-0000-4000-8000-000000000001',
        sourceId: 'src-invalid',
      }),
    ).rejects.toThrow(SourceNotFoundError)
  })

  it('deve retornar idempotentemente o registro se já estiver na biblioteca', async () => {
    const useCase = new AddToLibraryUseCase(libraryRepo, mockSourceRepo)
    const first = await useCase.execute({
      userId: '00000000-0000-4000-8000-000000000001',
      sourceId: 'src-valid',
    })
    const second = await useCase.execute({
      userId: '00000000-0000-4000-8000-000000000001',
      sourceId: 'src-valid',
    })

    expect(first.id).toBe(second.id)
    expect(libraryRepo.records.length).toBe(1)
  })
})
