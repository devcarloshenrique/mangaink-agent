import { describe, it, expect, beforeEach } from 'vitest'
import { RemoveFromLibraryUseCase } from '../../use-cases/remove-from-library.use-case'
import { InMemoryLibraryRepository } from '../helpers/in-memory-library.repository'


describe('RemoveFromLibraryUseCase', () => {
  let libraryRepo: InMemoryLibraryRepository

  beforeEach(() => {
    libraryRepo = new InMemoryLibraryRepository()
  })

  it('deve remover a obra da biblioteca do usuário', async () => {
    await libraryRepo.add('user-1', 'src-1')
    expect(libraryRepo.records.length).toBe(1)

    const useCase = new RemoveFromLibraryUseCase(libraryRepo)
    const result = await useCase.execute({ userId: 'user-1', sourceId: 'src-1' })

    expect(result).toEqual({ success: true })
    expect(libraryRepo.records.length).toBe(0)
  })

  it('deve ser idempotente caso o item não esteja na biblioteca', async () => {
    const useCase = new RemoveFromLibraryUseCase(libraryRepo)
    const result = await useCase.execute({ userId: 'user-1', sourceId: 'src-not-exists' })

    expect(result).toEqual({ success: true })
  })
})
