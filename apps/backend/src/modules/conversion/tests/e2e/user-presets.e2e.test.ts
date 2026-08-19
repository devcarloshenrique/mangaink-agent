import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { JWT_AUDIENCE, JWT_ISSUER } from '../../../auth/services/token.service'
import { randomUUID } from 'node:crypto'

const mockPresetRepo = {
  findAllByUserId: vi.fn(async () => [
    {
      id: 'preset-1',
      userId: 'user-1',
      name: 'Meu Kindle',
      description: 'Config Kindle',
      values: { mangaMode: true },
      isDefault: true,
      lastUsedAt: null,
      usageCount: 0,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ]),
  findById: vi.fn(async (id: string, userId: string) => {
    if (userId !== 'user-1') return null
    if (id === 'preset-1') {
      return {
        id: 'preset-1',
        userId: 'user-1',
        name: 'Meu Kindle',
        description: 'Config Kindle',
        values: { mangaMode: true },
        isDefault: true,
        lastUsedAt: null,
        usageCount: 0,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      }
    }
    return null
  }),
  create: vi.fn(async (data: Record<string, unknown>) => ({
    id: 'new-preset',
    userId: 'user-1',
    name: data.name,
    description: data.description ?? null,
    values: data.values,
    isDefault: data.isDefault ?? false,
    lastUsedAt: null,
    usageCount: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  })),
  updateMeta: vi.fn(async (_id: string, _uid: string, data: Record<string, unknown>) => ({
    id: 'preset-1',
    userId: 'user-1',
    name: data.name ?? 'Meu Kindle',
    description: data.description ?? 'Config Kindle',
    values: { mangaMode: true },
    isDefault: data.isDefault ?? false,
    lastUsedAt: null,
    usageCount: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  })),
  updateValues: vi.fn(async () => ({
    id: 'preset-1',
    userId: 'user-1',
    name: 'Meu Kindle',
    description: 'Config Kindle',
    values: { gamma: 2.0 },
    isDefault: false,
    lastUsedAt: null,
    usageCount: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  })),
  delete: vi.fn(async () => {}),
  toggleDefault: vi.fn(async () => {}),
  incrementUsage: vi.fn(async () => {}),
  touchLastUsed: vi.fn(async () => {}),
}

vi.mock('../../repositories/user-preset.repository', () => ({
  IUserPresetRepository: class {},
}))

vi.mock('../../repositories/prisma-user-preset.repository', () => ({
  PrismaUserPresetRepository: vi.fn(() => mockPresetRepo),
}))

let app: FastifyInstance

beforeAll(async () => {
  const { createServer } = await import('../../../../shared/server')
  app = await createServer()
  await app.ready()
})

afterAll(async () => {
  await app.close()
})

describe('User Presets E2E', () => {
  function authHeaders(): Record<string, string> {
    const token = app.jwt.sign({ sub: 'user-1', jti: randomUUID(), iss: JWT_ISSUER, aud: JWT_AUDIENCE })
    return { Authorization: `Bearer ${token}` }
  }

  describe('GET /api/conversions/presets', () => {
    it('retorna 401 sem autenticacao', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/conversions/presets',
      })

      expect(res.statusCode).toBe(401)
    })

    it('retorna 200 com lista de presets e limit', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/conversions/presets',
        headers: authHeaders(),
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.presets).toHaveLength(1)
      expect(body.presets[0].name).toBe('Meu Kindle')
      expect(body.limit).toBeGreaterThan(0)
    })
  })

  describe('POST /api/conversions/presets', () => {
    it('cria um preset com sucesso', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/conversions/presets',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Novo Preset',
          values: { gamma: 2.0 },
        }),
      })

      expect(res.statusCode).toBe(201)
      const body = res.json()
      expect(body.name).toBe('Novo Preset')
    })

    it('retorna 400 com nome vazio', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/conversions/presets',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: '',
          values: {},
        }),
      })

      expect(res.statusCode).toBe(400)
    })
  })

  describe('PATCH /api/conversions/presets/:presetId', () => {
    it('atualiza nome do preset', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/conversions/presets/preset-1',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Renomeado' }),
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.name).toBe('Renomeado')
    })

    it('retorna 404 para preset inexistente', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/conversions/presets/inexistente',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'X' }),
      })

      expect(res.statusCode).toBe(404)
    })
  })

  describe('PUT /api/conversions/presets/:presetId/values', () => {
    it('atualiza valores do preset', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/conversions/presets/preset-1/values',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: { gamma: 2.0 } }),
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.values).toEqual({ gamma: 2.0 })
    })
  })

  describe('DELETE /api/conversions/presets/:presetId', () => {
    it('exclui preset com sucesso', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/conversions/presets/preset-1',
        headers: authHeaders(),
      })

      expect(res.statusCode).toBe(204)
    })
  })
})
