import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'vitest'
import { getPrisma } from '../../../../shared/database/prisma'
import { PrismaUserPresetRepository } from '../../repositories/prisma-user-preset.repository'

let repo: PrismaUserPresetRepository
let userId: string
let otherUserId: string

beforeAll(async () => {
  repo = new PrismaUserPresetRepository()

  const user = await getPrisma().user.create({
    data: {
      username: `preset-test-${Date.now()}`,
      email: `preset-test-${Date.now()}@test.com`,
      passwordHash: 'hashed',
    },
  })
  userId = user.id

  const other = await getPrisma().user.create({
    data: {
      username: `preset-other-${Date.now()}`,
      email: `preset-other-${Date.now()}@test.com`,
      passwordHash: 'hashed',
    },
  })
  otherUserId = other.id
})

afterAll(async () => {
  const ids = [userId, otherUserId].filter(Boolean) as string[]
  if (ids.length > 0) {
    await getPrisma().userPreset.deleteMany({ where: { userId: { in: ids } } })
    await getPrisma().user.deleteMany({ where: { id: { in: ids } } })
  }
  await getPrisma().$disconnect()
})

beforeEach(async () => {
  await getPrisma().userPreset.deleteMany({ where: { userId: { in: [userId, otherUserId] } } })
})

describe('PrismaUserPresetRepository', () => {
  describe('create', () => {
    it('cria um preset com sucesso', async () => {
      const preset = await repo.create({
        userId,
        name: 'Meu Kindle',
        description: 'Config Kindle',
        values: { mangaMode: true },
        isDefault: false,
      })

      expect(preset.id).toBeTruthy()
      expect(preset.name).toBe('Meu Kindle')
      expect(preset.values).toEqual({ mangaMode: true })
      expect(preset.isDefault).toBe(false)
      expect(preset.usageCount).toBe(0)
      expect(preset.createdAt).toBeTruthy()
    })

    it('cria preset sem description', async () => {
      const preset = await repo.create({
        userId,
        name: 'Simples',
        values: {},
      })

      expect(preset.description).toBeNull()
    })

    it('rejeita nome duplicado por usuario (unique constraint)', async () => {
      await repo.create({ userId, name: 'Unico', values: {} })

      await expect(
        repo.create({ userId, name: 'Unico', values: {} }),
      ).rejects.toThrow()
    })

    it('permite mesmo nome para usuarios diferentes', async () => {
      const p1 = await repo.create({ userId, name: 'MesmoNome', values: {} })
      const p2 = await repo.create({ userId: otherUserId, name: 'MesmoNome', values: {} })

      expect(p1.id).not.toBe(p2.id)
    })
  })

  describe('findAllByUserId', () => {
    it('retorna lista vazia quando usuario nao tem presets', async () => {
      const presets = await repo.findAllByUserId(userId)
      expect(presets).toHaveLength(0)
    })

    it('retorna todos os presets do usuario', async () => {
      await repo.create({ userId, name: 'P1', values: { a: 1 } })
      await repo.create({ userId, name: 'P2', values: { b: 2 } })

      const presets = await repo.findAllByUserId(userId)
      expect(presets).toHaveLength(2)
    })

    it('nao retorna presets de outros usuarios', async () => {
      await repo.create({ userId, name: 'Meu', values: {} })
      await repo.create({ userId: otherUserId, name: 'Dele', values: {} })

      const presets = await repo.findAllByUserId(userId)
      expect(presets).toHaveLength(1)
      expect(presets[0].name).toBe('Meu')
    })
  })

  describe('findById', () => {
    it('retorna preset por id', async () => {
      const created = await repo.create({ userId, name: 'Buscar', values: {} })
      const found = await repo.findById(created.id, userId)

      expect(found).not.toBeNull()
      expect(found!.id).toBe(created.id)
    })

    it('retorna null para preset de outro usuario', async () => {
      const created = await repo.create({ userId: otherUserId, name: 'Dele', values: {} })
      const found = await repo.findById(created.id, userId)

      expect(found).toBeNull()
    })

    it('retorna null para id inexistente', async () => {
      const found = await repo.findById('00000000-0000-0000-0000-000000000000', userId)
      expect(found).toBeNull()
    })
  })

  describe('updateMeta', () => {
    it('atualiza nome e description', async () => {
      const created = await repo.create({ userId, name: 'Original', values: {} })
      const updated = await repo.updateMeta(created.id, userId, {
        name: 'Renomeado',
        description: 'Nova desc',
      })

      expect(updated.name).toBe('Renomeado')
      expect(updated.description).toBe('Nova desc')
    })

    it('atualiza isDefault', async () => {
      const created = await repo.create({ userId, name: 'NaoDefault', values: {} })
      const updated = await repo.updateMeta(created.id, userId, { isDefault: true })

      expect(updated.isDefault).toBe(true)
    })

    it('lanca erro ao tentar atualizar preset de outro usuario', async () => {
      const created = await repo.create({ userId: otherUserId, name: 'Dele', values: {} })

      await expect(
        repo.updateMeta(created.id, userId, { name: 'Hacked' }),
      ).rejects.toThrow('Preset não encontrado')
    })
  })

  describe('updateValues', () => {
    it('atualiza valores do preset', async () => {
      const created = await repo.create({ userId, name: 'Original', values: { a: 1 } })
      const updated = await repo.updateValues(created.id, userId, { b: 2, c: 'test' })

      expect(updated.values).toEqual({ b: 2, c: 'test' })
    })
  })

  describe('delete', () => {
    it('exclui o preset', async () => {
      const created = await repo.create({ userId, name: 'Remover', values: {} })
      await repo.delete(created.id, userId)

      const found = await repo.findById(created.id, userId)
      expect(found).toBeNull()
    })
  })

  describe('toggleDefault', () => {
    it('define isDefault true no preset alvo e false nos demais', async () => {
      const p1 = await repo.create({ userId, name: 'P1', values: {}, isDefault: true })
      const p2 = await repo.create({ userId, name: 'P2', values: {}, isDefault: false })

      await repo.toggleDefault(p2.id, userId)

      const found1 = await repo.findById(p1.id, userId)
      const found2 = await repo.findById(p2.id, userId)
      expect(found1!.isDefault).toBe(false)
      expect(found2!.isDefault).toBe(true)
    })

    it('nao afeta presets de outros usuarios', async () => {
      const otherPreset = await repo.create({ userId: otherUserId, name: 'OtherDef', values: {}, isDefault: true })
      const myPreset = await repo.create({ userId, name: 'MyNew', values: {}, isDefault: false })

      await repo.toggleDefault(myPreset.id, userId)

      const other = await repo.findById(otherPreset.id, otherUserId)
      expect(other!.isDefault).toBe(true)
    })
  })

  describe('incrementUsage', () => {
    it('incrementa usageCount em 1', async () => {
      const created = await repo.create({ userId, name: 'Usado', values: {} })
      await repo.incrementUsage(created.id)

      const found = await repo.findById(created.id, userId)
      expect(found!.usageCount).toBe(1)
    })
  })

  describe('touchLastUsed', () => {
    it('atualiza lastUsedAt para timestamp atual', async () => {
      const created = await repo.create({ userId, name: 'Tocado', values: {} })
      expect(created.lastUsedAt).toBeNull()

      await repo.touchLastUsed(created.id)

      const found = await repo.findById(created.id, userId)
      expect(found!.lastUsedAt).toBeTruthy()
      expect(new Date(found!.lastUsedAt!).getTime()).toBeGreaterThan(0)
    })
  })

  describe('cascade delete', () => {
    it('presets sao removidos quando usuario eh deletado', async () => {
      const tempUser = await getPrisma().user.create({
        data: {
          username: `cascade-test-${Date.now()}`,
          email: `cascade-test-${Date.now()}@test.com`,
          passwordHash: 'hashed',
        },
      })

      await repo.create({ userId: tempUser.id, name: 'Cascade', values: {} })

      await getPrisma().user.delete({ where: { id: tempUser.id } })

      const presets = await getPrisma().userPreset.findMany({ where: { userId: tempUser.id } })
      expect(presets).toHaveLength(0)
    })
  })
})
