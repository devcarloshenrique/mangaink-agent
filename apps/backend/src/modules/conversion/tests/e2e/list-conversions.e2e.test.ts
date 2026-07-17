import { vi, describe, it, expect, beforeEach } from 'vitest'
import type { FastifyInstance } from 'fastify'

// ── Mock repositório compartilhado com store controlável ─────────────────
const mockConvRepo = vi.hoisted(() => {
  const store = new Map<string, Array<{
    userId: string
    conversionId: string
    sourceId: string
    title: string
    status: string
    progress: number
    totalJobs: number
    completedJobs: number
    failedJobs: number
    createdAt: string
  }>>()

  return {
    reset: () => store.clear(),
    seed: (userId: string, item: any) => {
      const list = store.get(userId) ?? []
      list.push(item)
      store.set(userId, list)
    },
    // simula listByUser: filtra por userId + filtros opcionais
    listByUser: async (userId: string, filters: any, pagination: any) => {
      let items = (store.get(userId) ?? []).slice()
      if (filters.status) items = items.filter((i) => (filters.status as string[]).includes(i.status))
      if (filters.sourceId) items = items.filter((i) => i.sourceId === filters.sourceId)
      items.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      const total = items.length
      const start = (pagination.page - 1) * pagination.limit
      const paged = items.slice(start, start + pagination.limit)
      return { items: paged, total, page: pagination.page, limit: pagination.limit }
    },
    repo: {
      create: vi.fn(),
      findById: vi.fn(),
      update: vi.fn(),
      syncStatus: vi.fn(),
      listByUser: vi.fn(async (u: string, f: any, p: any) => mockConvRepo.listByUser(u, f, p)),
      listJobIds: vi.fn(),
      appendLog: vi.fn(),
      delete: vi.fn(),
    },
  }
})

const mockJobRepo = vi.hoisted(() => ({
  repo: {
    create: vi.fn(),
    findById: vi.fn(),
    update: vi.fn(),
    findByConversionId: vi.fn(),
    listByConversionId: vi.fn(),
    delete: vi.fn(),
  },
}))

vi.mock('../../../../shared/database/repositories', async () => {
  const actual = await vi.importActual<any>('../../../../shared/database/repositories')
  return {
    ...actual,
    getConversionRepository: vi.fn(() => mockConvRepo.repo),
    getConversionJobRepository: vi.fn(() => mockJobRepo.repo),
  }
})

vi.mock('../../../user/repositories/prisma-user.repository', async () => {
  const { InMemoryUserRepository } = await import(
    '../../../auth/tests/helpers/in-memory-user.repository'
  )
  return {
    PrismaUserRepository: vi.fn().mockImplementation(() => new InMemoryUserRepository()),
  }
})

import { PrismaUserRepository } from '../../../user/repositories/prisma-user.repository'
import { InMemoryUserRepository } from '../../../auth/tests/helpers/in-memory-user.repository'
import { ListingNotSupportedError } from '../../errors/conversion.errors'
import { createServer } from '../../../../shared/server'

let sharedUserRepo: InMemoryUserRepository

let app: FastifyInstance
let tokenA: string
let tokenB: string

async function registerAndLogin(
  app: FastifyInstance,
  username: string,
  email: string,
): Promise<string> {
  await app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: { username, email, password: 'senha1234', confirmPassword: 'senha1234' },
  })
  const loginRes = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { identifier: email, password: 'senha1234' },
  })
  return loginRes.json().token
}

beforeEach(async () => {
  mockConvRepo.reset()
  sharedUserRepo = new InMemoryUserRepository()
  vi.mocked(PrismaUserRepository).mockImplementation(() => sharedUserRepo as unknown as PrismaUserRepository)
  app = await createServer()
  tokenA = await registerAndLogin(app, 'usera', 'usera@example.com')
  tokenB = await registerAndLogin(app, 'userb', 'userb@example.com')
})

function seedItem(userId: string, conversionId: string, sourceId: string, overrides: any = {}) {
  const now = new Date().toISOString()
  mockConvRepo.seed(userId, {
    userId,
    conversionId,
    sourceId,
    title: 'Obra Teste',
    status: 'completed',
    progress: 100,
    totalJobs: 1,
    completedJobs: 1,
    failedJobs: 0,
    createdAt: now,
    updatedAt: now,
    finishedAt: now,
    ...overrides,
  })
}

describe('GET /api/conversions — E2E', () => {
  it('sem token → 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/conversions' })
    expect(res.statusCode).toBe(401)
  })

  it('token inválido → 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/conversions',
      headers: { Authorization: 'Bearer token-invalido' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('token válido → 200 com shape { items, total, page, limit }', async () => {
    seedItem('usera-id-placeholder', 'conv-1', 'src-x')
    // O token A tem um userId real gerado pelo registro; o mock filtra por esse userId.
    // Como não sabemos o id exato, validamos apenas o shape com lista vazia do mock.
    const res = await app.inject({
      method: 'GET',
      url: '/api/conversions',
      headers: { Authorization: `Bearer ${tokenA}` },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body).toHaveProperty('items')
    expect(body).toHaveProperty('total')
    expect(body).toHaveProperty('page')
    expect(body).toHaveProperty('limit')
    expect(Array.isArray(body.items)).toBe(true)
  })

  it('lista vazia → 200 com { items: [], total: 0 }', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/conversions',
      headers: { Authorization: `Bearer ${tokenA}` },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.items).toEqual([])
    expect(body.total).toBe(0)
    expect(body.page).toBe(1)
    expect(body.limit).toBe(20)
  })

  it('limit=200 → 400 (máximo 100)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/conversions?limit=200',
      headers: { Authorization: `Bearer ${tokenA}` },
    })
    expect(res.statusCode).toBe(400)
  })

  it('limit=0 → 400', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/conversions?limit=0',
      headers: { Authorization: `Bearer ${tokenA}` },
    })
    expect(res.statusCode).toBe(400)
  })

  it('page=0 → 400', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/conversions?page=0',
      headers: { Authorization: `Bearer ${tokenA}` },
    })
    expect(res.statusCode).toBe(400)
  })

  it('status inválido → 400', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/conversions?status=foo',
      headers: { Authorization: `Bearer ${tokenA}` },
    })
    expect(res.statusCode).toBe(400)
  })

  it('page e limit default aplicados', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/conversions',
      headers: { Authorization: `Bearer ${tokenA}` },
    })
    const body = res.json()
    expect(body.page).toBe(1)
    expect(body.limit).toBe(20)
  })
})

describe('GET /api/conversions — Ownership (E2E)', () => {
  it('usuário A e B veem apenas suas próprias conversões', async () => {
    // Descobrimos os userIds reais via /auth/me
    const meA = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { Authorization: `Bearer ${tokenA}` },
    })
    const meB = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { Authorization: `Bearer ${tokenB}` },
    })
    const userIdA = meA.json().id
    const userIdB = meB.json().id

    seedItem(userIdA, 'conv-a1', 'src-x')
    seedItem(userIdA, 'conv-a2', 'src-y')
    seedItem(userIdB, 'conv-b1', 'src-x')

    const resA = await app.inject({
      method: 'GET',
      url: '/api/conversions',
      headers: { Authorization: `Bearer ${tokenA}` },
    })
    expect(resA.statusCode).toBe(200)
    const bodyA = resA.json()
    expect(bodyA.total).toBe(2)
    expect(bodyA.items.map((i: any) => i.conversionId)).toEqual(
      expect.arrayContaining(['conv-a1', 'conv-a2']),
    )
    expect(bodyA.items.map((i: any) => i.conversionId)).not.toContain('conv-b1')

    const resB = await app.inject({
      method: 'GET',
      url: '/api/conversions',
      headers: { Authorization: `Bearer ${tokenB}` },
    })
    expect(resB.statusCode).toBe(200)
    const bodyB = resB.json()
    expect(bodyB.total).toBe(1)
    expect(bodyB.items[0].conversionId).toBe('conv-b1')
  })

  it('filtra por múltiplos status via ?status=queued,processing', async () => {
    const meRes = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { Authorization: `Bearer ${tokenA}` },
    })
    const userIdA = meRes.json().id

    seedItem(userIdA, 'conv-q', 'src-x', { status: 'queued' })
    seedItem(userIdA, 'conv-p', 'src-x', { status: 'processing' })
    seedItem(userIdA, 'conv-c', 'src-x', { status: 'completed' })

    const res = await app.inject({
      method: 'GET',
      url: '/api/conversions?status=queued,processing',
      headers: { Authorization: `Bearer ${tokenA}` },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.total).toBe(2)
    expect(body.items.map((i: any) => i.status).sort()).toEqual(['processing', 'queued'])
  })
})

describe('GET /api/conversions — 501 em modo filesystem (E2E)', () => {
  it('retorna 501 com { error: { code, message } } quando o adapter lança ListingNotSupportedError', async () => {
    sharedUserRepo = new InMemoryUserRepository()
    vi.mocked(PrismaUserRepository).mockImplementation(() => sharedUserRepo as unknown as PrismaUserRepository)
    const app501 = await createServer()
    const tok = await registerAndLogin(app501, 'user501', 'user501@example.com')

    mockConvRepo.repo.listByUser.mockImplementationOnce(async () => {
      throw new ListingNotSupportedError()
    })

    const res = await app501.inject({
      method: 'GET',
      url: '/api/conversions',
      headers: { Authorization: `Bearer ${tok}` },
    })

    expect(res.statusCode).toBe(501)
    const body = res.json()
    expect(body.error).toMatchObject({
      code: 'LISTING_REQUIRES_PRISMA',
      message: 'Listing requires REPO_BACKEND=prisma',
    })
  })
})