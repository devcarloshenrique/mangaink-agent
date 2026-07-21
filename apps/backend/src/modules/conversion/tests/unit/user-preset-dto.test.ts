import { describe, expect, it } from 'vitest'
import {
  createUserPresetSchema,
  updateUserPresetSchema,
  updateUserPresetValuesSchema,
  presetParamsSchema,
  userPresetResponseSchema,
  userPresetListResponseSchema,
} from '../../dtos/user-preset.dto'

describe('user-preset DTOs', () => {
  describe('createUserPresetSchema', () => {
    it('aceita um preset valido com todos os campos', () => {
      const result = createUserPresetSchema.parse({
        name: 'Meu Kindle',
        description: 'Config otimizada para Kindle',
        values: { mangaMode: true, gamma: 2.0 },
        isDefault: true,
      })

      expect(result.name).toBe('Meu Kindle')
      expect(result.description).toBe('Config otimizada para Kindle')
      expect(result.values).toEqual({ mangaMode: true, gamma: 2.0 })
      expect(result.isDefault).toBe(true)
    })

    it('aceita preset sem description e isDefault (usa defaults)', () => {
      const result = createUserPresetSchema.parse({
        name: 'Simples',
        values: { noProcessing: true },
      })

      expect(result.description).toBeUndefined()
      expect(result.isDefault).toBe(false)
    })

    it('rejeita nome vazio', () => {
      expect(() =>
        createUserPresetSchema.parse({ name: '', values: {} }),
      ).toThrow()
    })

    it('rejeita nome com mais de 100 caracteres', () => {
      expect(() =>
        createUserPresetSchema.parse({
          name: 'a'.repeat(101),
          values: {},
        }),
      ).toThrow()
    })

    it('rejeita descricao com mais de 500 caracteres', () => {
      expect(() =>
        createUserPresetSchema.parse({
          name: 'valido',
          description: 'a'.repeat(501),
          values: {},
        }),
      ).toThrow()
    })

    it('rejeita values vazio (sem chaves)', () => {
      expect(() =>
        createUserPresetSchema.parse({ name: 'valido' }),
      ).toThrow()
    })
  })

  describe('updateUserPresetSchema', () => {
    it('aceita atualizacao apenas do nome', () => {
      const result = updateUserPresetSchema.parse({ name: 'Novo nome' })

      expect(result.name).toBe('Novo nome')
      expect(result.description).toBeUndefined()
      expect(result.isDefault).toBeUndefined()
    })

    it('aceita body vazio (todos os campos sao opcionais)', () => {
      const result = updateUserPresetSchema.parse({})

      expect(result).toEqual({})
    })

    it('aceita description como null (limpar)', () => {
      const result = updateUserPresetSchema.parse({ description: null })

      expect(result.description).toBeNull()
    })

    it('rejeita nome vazio se fornecido', () => {
      expect(() => updateUserPresetSchema.parse({ name: '' })).toThrow()
    })
  })

  describe('updateUserPresetValuesSchema', () => {
    it('aceita values valido', () => {
      const result = updateUserPresetValuesSchema.parse({
        values: { mangaMode: false, gamma: 1.8 },
      })

      expect(result.values).toEqual({ mangaMode: false, gamma: 1.8 })
    })

    it('rejeita values ausente', () => {
      expect(() =>
        updateUserPresetValuesSchema.parse({}),
      ).toThrow()
    })

    it('rejeita values nao-objeto', () => {
      expect(() =>
        updateUserPresetValuesSchema.parse({ values: 'invalid' }),
      ).toThrow()
    })
  })

  describe('presetParamsSchema', () => {
    it('aceita presetId valido', () => {
      const result = presetParamsSchema.parse({ presetId: 'abc-123' })

      expect(result.presetId).toBe('abc-123')
    })

    it('rejeita presetId vazio', () => {
      expect(() => presetParamsSchema.parse({ presetId: '' })).toThrow()
    })
  })

  describe('userPresetResponseSchema', () => {
    const validResponse = {
      id: 'uuid-1',
      name: 'Meu Kindle',
      description: 'Config Kindle',
      values: { mangaMode: true },
      isDefault: false,
      lastUsedAt: null,
      usageCount: 0,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }

    it('aceita response valida', () => {
      const result = userPresetResponseSchema.parse(validResponse)
      expect(result.id).toBe('uuid-1')
    })

    it('aceita response sem description', () => {
      const { description: _, ...withoutDesc } = validResponse
      const result = userPresetResponseSchema.parse(withoutDesc)
      expect(result.description).toBeUndefined()
    })

    it('aceita lastUsedAt como string', () => {
      const result = userPresetResponseSchema.parse({
        ...validResponse,
        lastUsedAt: '2026-01-01T00:00:00.000Z',
      })
      expect(result.lastUsedAt).toBe('2026-01-01T00:00:00.000Z')
    })
  })

  describe('userPresetListResponseSchema', () => {
    it('aceita lista valida com limit', () => {
      const result = userPresetListResponseSchema.parse({
        presets: [
          {
            id: 'uuid-1',
            name: 'Meu Kindle',
            values: {},
            isDefault: false,
            lastUsedAt: null,
            usageCount: 0,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        limit: 20,
      })

      expect(result.presets).toHaveLength(1)
      expect(result.limit).toBe(20)
    })

    it('rejeita limit negativo', () => {
      expect(() =>
        userPresetListResponseSchema.parse({ presets: [], limit: -1 }),
      ).toThrow()
    })
  })
})
