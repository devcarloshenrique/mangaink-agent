import { describe, it, expect, vi } from 'vitest'
import {
  ListUserPresetsUseCase,
  CreateUserPresetUseCase,
  UpdateUserPresetMetaUseCase,
  UpdateUserPresetValuesUseCase,
  DeleteUserPresetUseCase,
} from '../../use-cases/user-presets.use-case'
import {
  UserPresetNotFoundError,
  DuplicatePresetNameError,
  PresetLimitReachedError,
} from '../../errors/conversion.errors'
import type { IUserPresetRepository } from '../../repositories/user-preset.repository'
import type { UserPreset } from '../../types/conversion.types'

const TEST_USER = 'test-user-001'
const OTHER_USER = 'other-user-999'

function makePreset(overrides: Partial<UserPreset> = {}): UserPreset {
  return {
    id: 'preset-001',
    userId: TEST_USER,
    name: 'Meu Kindle',
    description: 'Config Kindle',
    values: { mangaMode: true },
    isDefault: false,
    lastUsedAt: null,
    usageCount: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function makeMockRepo(overrides: Partial<IUserPresetRepository> = {}): IUserPresetRepository {
  return {
    findAllByUserId: vi.fn(async () => []),
    findById: vi.fn(async (_id: string, _uid: string) => null),
    create: vi.fn(async (data) => makePreset({ name: data.name, values: data.values })),
    updateMeta: vi.fn(async (_id, _uid, data) =>
      makePreset({ name: data.name ?? 'Meu Kindle', isDefault: data.isDefault ?? false }),
    ),
    updateValues: vi.fn(async () => makePreset()),
    delete: vi.fn(async () => {}),
    toggleDefault: vi.fn(async () => {}),
    incrementUsage: vi.fn(async () => {}),
    touchLastUsed: vi.fn(async () => {}),
    ...overrides,
  }
}

describe('ListUserPresetsUseCase', () => {
  it('retorna lista de presets do usuario', async () => {
    const presets = [makePreset({ id: 'p1' }), makePreset({ id: 'p2' })]
    const repo = makeMockRepo({ findAllByUserId: vi.fn(async () => presets) })
    const useCase = new ListUserPresetsUseCase(repo)

    const result = await useCase.execute(TEST_USER)

    expect(result.presets).toHaveLength(2)
    expect(result.limit).toBe(20)
  })

  it('retorna lista vazia', async () => {
    const repo = makeMockRepo()
    const useCase = new ListUserPresetsUseCase(repo)

    const result = await useCase.execute(TEST_USER)

    expect(result.presets).toHaveLength(0)
    expect(result.limit).toBe(20)
  })
})

describe('CreateUserPresetUseCase', () => {
  it('cria preset com sucesso', async () => {
    const repo = makeMockRepo({
      findAllByUserId: vi.fn(async () => []),
    })
    const useCase = new CreateUserPresetUseCase(repo, 20)

    const result = await useCase.execute(TEST_USER, {
      name: 'Meu Kindle',
      values: { mangaMode: true },
    })

    expect(result.name).toBe('Meu Kindle')
    expect(result.values).toEqual({ mangaMode: true })
  })

  it('rejeita criacao quando limite atingido', async () => {
    const existing = Array.from({ length: 20 }, (_, i) =>
      makePreset({ id: `p${i}`, name: `Preset ${i}` }),
    )
    const repo = makeMockRepo({ findAllByUserId: vi.fn(async () => existing) })
    const useCase = new CreateUserPresetUseCase(repo, 20)

    await expect(
      useCase.execute(TEST_USER, { name: 'Extra', values: {} }),
    ).rejects.toThrow(PresetLimitReachedError)
  })

  it('rejeita nome duplicado', async () => {
    const repo = makeMockRepo({
      findAllByUserId: vi.fn(async () => [makePreset({ name: 'Unico' })]),
    })
    const useCase = new CreateUserPresetUseCase(repo, 20)

    await expect(
      useCase.execute(TEST_USER, { name: 'Unico', values: {} }),
    ).rejects.toThrow(DuplicatePresetNameError)
  })

  it('define isDefault true e desmarca anterior via transacao', async () => {
    const toggleDefault = vi.fn(async () => {})
    const repo = makeMockRepo({
      findAllByUserId: vi.fn(async () => []),
      toggleDefault,
      create: vi.fn(async () => makePreset({ isDefault: true })),
    })
    const useCase = new CreateUserPresetUseCase(repo, 20)

    const result = await useCase.execute(TEST_USER, {
      name: 'Default',
      values: {},
      isDefault: true,
    })

    expect(result.isDefault).toBe(true)
    expect(toggleDefault).toHaveBeenCalled()
  })

  it('nao chama toggleDefault quando isDefault false', async () => {
    const toggleDefault = vi.fn(async () => {})
    const repo = makeMockRepo({
      findAllByUserId: vi.fn(async () => []),
      toggleDefault,
    })
    const useCase = new CreateUserPresetUseCase(repo, 20)

    await useCase.execute(TEST_USER, { name: 'Normal', values: {} })

    expect(toggleDefault).not.toHaveBeenCalled()
  })
})

describe('UpdateUserPresetMetaUseCase', () => {
  it('atualiza metadados com sucesso', async () => {
    const repo = makeMockRepo({
      findById: vi.fn(async () => makePreset()),
    })
    const useCase = new UpdateUserPresetMetaUseCase(repo)

    const result = await useCase.execute('preset-001', TEST_USER, {
      name: 'Renomeado',
      description: 'Nova desc',
    })

    expect(result.name).toBe('Renomeado')
  })

  it('lanca erro se preset nao existe', async () => {
    const repo = makeMockRepo({ findById: vi.fn(async () => null) })
    const useCase = new UpdateUserPresetMetaUseCase(repo)

    await expect(
      useCase.execute('inexistente', TEST_USER, { name: 'X' }),
    ).rejects.toThrow(UserPresetNotFoundError)
  })

  it('lanca erro se preset pertence a outro usuario', async () => {
    const repo = makeMockRepo({
      findById: vi.fn(async (_id: string, userId: string) =>
        userId === TEST_USER ? null : makePreset({ userId: OTHER_USER }),
      ),
    })
    const useCase = new UpdateUserPresetMetaUseCase(repo)

    await expect(
      useCase.execute('preset-001', TEST_USER, { name: 'X' }),
    ).rejects.toThrow(UserPresetNotFoundError)
  })

  it('aplica toggleDefault quando isDefault true', async () => {
    const toggleDefault = vi.fn(async () => {})
    const repo = makeMockRepo({
      findById: vi.fn(async () => makePreset()),
      toggleDefault,
    })
    const useCase = new UpdateUserPresetMetaUseCase(repo)

    await useCase.execute('preset-001', TEST_USER, { isDefault: true })

    expect(toggleDefault).toHaveBeenCalledWith('preset-001', TEST_USER)
  })
})

describe('UpdateUserPresetValuesUseCase', () => {
  it('atualiza valores com sucesso', async () => {
    const repo = makeMockRepo({
      findById: vi.fn(async () => makePreset()),
      updateValues: vi.fn(async () => makePreset({ values: { gamma: 2.0 } })),
    })
    const useCase = new UpdateUserPresetValuesUseCase(repo)

    const result = await useCase.execute('preset-001', TEST_USER, { gamma: 2.0 })

    expect(result.values).toEqual({ gamma: 2.0 })
  })

  it('lanca erro se preset nao encontrado', async () => {
    const repo = makeMockRepo({ findById: vi.fn(async () => null) })
    const useCase = new UpdateUserPresetValuesUseCase(repo)

    await expect(
      useCase.execute('inexistente', TEST_USER, {}),
    ).rejects.toThrow(UserPresetNotFoundError)
  })
})

describe('DeleteUserPresetUseCase', () => {
  it('exclui preset com sucesso', async () => {
    const repo = makeMockRepo({
      findById: vi.fn(async () => makePreset()),
    })
    const useCase = new DeleteUserPresetUseCase(repo)

    await expect(
      useCase.execute('preset-001', TEST_USER),
    ).resolves.toBeUndefined()
  })

  it('lanca erro se preset nao encontrado', async () => {
    const repo = makeMockRepo({ findById: vi.fn(async () => null) })
    const useCase = new DeleteUserPresetUseCase(repo)

    await expect(
      useCase.execute('inexistente', TEST_USER),
    ).rejects.toThrow(UserPresetNotFoundError)
  })

  it('lanca erro se preset de outro usuario', async () => {
    const repo = makeMockRepo({
      findById: vi.fn(async (_id: string, userId: string) =>
        userId === TEST_USER ? null : makePreset({ userId: OTHER_USER }),
      ),
    })
    const useCase = new DeleteUserPresetUseCase(repo)

    await expect(
      useCase.execute('preset-001', TEST_USER),
    ).rejects.toThrow(UserPresetNotFoundError)
  })
})
