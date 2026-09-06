import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { InMemoryLibraryRepository } from '../helpers/in-memory-library.repository'
import { JWT_ISSUER, JWT_AUDIENCE } from '../../../auth/services/token.service'
import { randomUUID } from 'node:crypto'

let libraryMockRepo: InMemoryLibraryRepository
let mockSourceStore: Map<string, any>

vi.mock('../../../../shared/database/prisma', () => ({
  getPrisma: () => ({
    userLibrary: {
      findMany: vi.fn(async ({ where }: any) => {
        const items = await libraryMockRepo.listByUser(where.userId, { isFavorite: where.isFavorite })
        return items.map((i) => ({
          ...i,
          source: mockSourceStore.get(i.sourceId) ? {
            sourceId: i.sourceId,
            metadata: mockSourceStore.get(i.sourceId).metadata,
            covers: mockSourceStore.get(i.sourceId).covers,
            _count: { chapters: mockSourceStore.get(i.sourceId).chapters.length },
          } : null,
        }))
      }),
      findUnique: vi.fn(async ({ where }: any) => {
        const item = await libraryMockRepo.findByUserAndSource(where.userId_sourceId.userId, where.userId_sourceId.sourceId)
        return item
      }),
      upsert: vi.fn(async ({ where, create, update }: any) => {
        const existing = await libraryMockRepo.findByUserAndSource(where.userId_sourceId.userId, where.userId_sourceId.sourceId)
        if (existing) {
          if (update.isFavorite !== undefined) {
            return libraryMockRepo.setFavorite(where.userId_sourceId.userId, where.userId_sourceId.sourceId, update.isFavorite)
          }
          return existing
        }
        const created = await libraryMockRepo.add(create.userId, create.sourceId)
        if (create.isFavorite !== undefined) {
          return libraryMockRepo.setFavorite(create.userId, create.sourceId, create.isFavorite)
        }
        return created
      }),
      deleteMany: vi.fn(async ({ where }: any) => {
        await libraryMockRepo.remove(where.userId, where.sourceId)
        return { count: 1 }
      }),
    },
    source: {
      count: vi.fn(async ({ where }: any) => {
        return mockSourceStore.has(where.sourceId) ? 1 : 0
      }),
      findUnique: vi.fn(async ({ where }: any) => {
        return mockSourceStore.get(where.sourceId) ?? null
      }),
    },
  }),
}))

describe('Library E2E (/api/library)', () => {
  let app: FastifyInstance
  const userId = '00000000-0000-4000-8000-000000000001'
  let token: string

  beforeEach(async () => {
    libraryMockRepo = new InMemoryLibraryRepository()
    mockSourceStore = new Map()
    mockSourceStore.set('src-berserk', {
      sourceId: 'src-berserk',
      metadata: { title: 'Berserk', author: 'Kentaro Miura' },
      covers: [{ type: 'original', imageUrl: 'https://img.com/berserk.jpg' }],
      chapters: [{ chapterId: '1' }, { chapterId: '2' }],
    })

    const { createServer } = await import('../../../../shared/server')
    app = await createServer()
    token = app.jwt.sign({
      sub: userId,
      jti: randomUUID(),
      iss: JWT_ISSUER,
      aud: JWT_AUDIENCE,
    })
  })







  it('GET /api/library → 401 sem token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/library',
    })
    expect(res.statusCode).toBe(401)
  })

  it('GET /api/library → 200 com lista vazia inicialmente', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/library',
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({
      items: [],
      total: 0,
    })
  })

  it('POST /api/library → 200 adiciona à biblioteca', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/library',
      headers: { Authorization: `Bearer ${token}` },
      payload: { sourceId: 'src-berserk' },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({
      userId,
      sourceId: 'src-berserk',
      isFavorite: false,
    })
  })

  it('POST /api/library → 404 se a source não existir', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/library',
      headers: { Authorization: `Bearer ${token}` },
      payload: { sourceId: 'src-inexistente' },
    })

    expect(res.statusCode).toBe(404)
  })

  it('PATCH /api/library/:sourceId/favorite → 200 favorita a obra', async () => {
    // Primeiro adiciona
    await app.inject({
      method: 'POST',
      url: '/api/library',
      headers: { Authorization: `Bearer ${token}` },
      payload: { sourceId: 'src-berserk' },
    })

    const res = await app.inject({
      method: 'PATCH',
      url: '/api/library/src-berserk/favorite',
      headers: { Authorization: `Bearer ${token}` },
      payload: { isFavorite: true },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().isFavorite).toBe(true)

    // Toggle sem payload
    const resToggle = await app.inject({
      method: 'PATCH',
      url: '/api/library/src-berserk/favorite',
      headers: { Authorization: `Bearer ${token}` },
      payload: {},
    })

    expect(resToggle.statusCode).toBe(200)
    expect(resToggle.json().isFavorite).toBe(false)
  })

  it('DELETE /api/library/:sourceId → 200 remove da biblioteca', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/library',
      headers: { Authorization: `Bearer ${token}` },
      payload: { sourceId: 'src-berserk' },
    })

    const res = await app.inject({
      method: 'DELETE',
      url: '/api/library/src-berserk',
      headers: { Authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ success: true })

    const listRes = await app.inject({
      method: 'GET',
      url: '/api/library',
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(listRes.json().total).toBe(0)
  })
})
