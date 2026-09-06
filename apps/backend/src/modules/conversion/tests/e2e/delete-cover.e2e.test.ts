import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { JWT_AUDIENCE, JWT_ISSUER } from '../../../auth/services/token.service'
import { getPrisma } from '../../../../shared/database/prisma'

const hoisted = vi.hoisted(() => {
  const validJpgBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46])
  return { validJpgBuffer }
})

vi.mock('../../../../shared/database/repositories', () => ({
  getConversionRepository: vi.fn(() => ({
    create: vi.fn(), findById: vi.fn(), update: vi.fn(), syncStatus: vi.fn(),
    listJobIds: vi.fn(), appendLog: vi.fn(), delete: vi.fn(),
  })),
  getConversionJobRepository: vi.fn(),
  getSourceRepository: vi.fn(() => ({
    load: vi.fn(async () => null),
    exists: vi.fn(async () => false),
  })),
  getNotificationRepository: vi.fn(() => ({
    create: vi.fn(),
    listByUserId: vi.fn(async () => []),
    countUnreadByUserId: vi.fn(async () => 0),
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
    clearByUserId: vi.fn(),
    pruneKeepLatest: vi.fn(),
  })),
  getProviderRepository: vi.fn(() => ({
    findAll: vi.fn(async () => []),
    findBySlug: vi.fn(async () => null),
    upsertFromSeed: vi.fn(async () => {}),
    update: vi.fn(async () => null),
  })),
}))

vi.mock('../../../../shared/infra/redis', async () => {
  const actual = await vi.importActual<
    typeof import('../../../../shared/infra/redis')
  >('../../../../shared/infra/redis')
  return {
    ...actual,
    RedisPubSubAdapter: vi.fn(() => ({
      publish: vi.fn(), subscribe: vi.fn(), subscribeMany: vi.fn(),
      unsubscribe: vi.fn(), unsubscribeMany: vi.fn(),
    })),
    RedisJournalAdapter: vi.fn(() => ({
      append: vi.fn(), range: vi.fn(async () => []), nextId: vi.fn(), expire: vi.fn(),
    })),
  }
})

vi.mock('../../../../shared/redis/bullmq', () => ({
  createQueue: vi.fn(() => ({
    add: vi.fn(async () => ({})),
    getJob: vi.fn(async () => null),
    close: vi.fn(async () => {}),
  })),
}))

vi.mock('../../../../shared/redis/redis', () => ({
  default: { on: vi.fn(), get: vi.fn(), set: vi.fn() },
}))

vi.mock('bullmq', () => ({
  Worker: vi.fn().mockImplementation(() => ({ on: vi.fn(), close: vi.fn() })),
  Queue: vi.fn(),
}))

describe('Delete Cover API E2E', () => {
  let app: FastifyInstance
  let token: string

  beforeEach(async () => {
    const mod = await import('../../../../shared/server')
    app = await mod.createServer()

    token = app.jwt.sign(
      { sub: 'user-test-delete-cover' },
      {
        iss: JWT_ISSUER,
        aud: JWT_AUDIENCE,
        expiresIn: '1h',
        jti: 'session-e2e-delete-cover',
      },
    )
  })

  describe('DELETE /api/conversions/covers/:coverId', () => {
    it('deve retornar 401 se não estiver autenticado', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/conversions/covers/up_test_123',
      })
      expect(res.statusCode).toBe(401)
    })

    it('deve retornar 404 se a capa não for encontrada', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/conversions/covers/up_inexistente_99999',
        headers: {
          authorization: `Bearer ${token}`,
        },
      })
      expect(res.statusCode).toBe(404)
    })

    it('deve retornar 200 e excluir capa criada por upload', async () => {
      // 1. Cria capa via upload
      const uploadRes = await app.inject({
        method: 'POST',
        url: '/api/conversions/covers/upload',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          fileName: 'cover-to-delete.jpg',
          contentType: 'image/jpeg',
          base64Data: `data:image/jpeg;base64,${hoisted.validJpgBuffer.toString('base64')}`,
        },
      })

      expect(uploadRes.statusCode).toBe(201)
      const { uploadId } = uploadRes.json()

      // 2. Verifica se capa está acessível via GET
      const getBeforeRes = await app.inject({
        method: 'GET',
        url: `/api/conversions/covers/uploaded/${uploadId}`,
      })
      expect(getBeforeRes.statusCode).toBe(200)

      // 3. Deleta a capa
      const deleteRes = await app.inject({
        method: 'DELETE',
        url: `/api/conversions/covers/${uploadId}`,
        headers: {
          authorization: `Bearer ${token}`,
        },
      })

      expect(deleteRes.statusCode).toBe(200)
      expect(deleteRes.json()).toEqual({
        success: true,
        message: 'Capa excluída com sucesso.',
      })

      // 4. Verifica se agora retorna 404 no GET
      const getAfterRes = await app.inject({
        method: 'GET',
        url: `/api/conversions/covers/uploaded/${uploadId}`,
      })
      expect(getAfterRes.statusCode).toBe(404)
    })

    it('deve retornar 404 ao deletar capa de outro usuário e 200 para o dono', async () => {
      const prisma = getPrisma()
      const ownerId = randomUUID()
      const otherId = randomUUID()
      const sourceId = `src_e2e_cross_user_${randomUUID().slice(0, 8)}`
      const coverId = `up_e2e_cross_${randomUUID().slice(0, 8)}`

      await prisma.user.createMany({
        data: [
          { id: ownerId, username: `e2e_owner_${ownerId.slice(0, 8)}`, email: `${ownerId}@e2e.test`, passwordHash: 'x' },
          { id: otherId, username: `e2e_other_${otherId.slice(0, 8)}`, email: `${otherId}@e2e.test`, passwordHash: 'x' },
        ],
      })
      await prisma.source.create({
        data: {
          sourceId,
          url: 'https://example.com/manga-e2e',
          metadata: {},
          status: 'ready',
          providerSlug: 'e2e-provider',
          providerName: 'E2E Provider',
        },
      })
      await prisma.cover.create({
        data: {
          coverId,
          sourceId,
          type: 'upload',
          label: 'Capa do dono',
          imageUrl: `/api/conversions/covers/uploaded/${coverId}`,
          userId: ownerId,
        },
      })

      try {
        const signToken = (sub: string) =>
          app.jwt.sign(
            { sub },
            { iss: JWT_ISSUER, aud: JWT_AUDIENCE, expiresIn: '1h', jti: `session-e2e-${sub}` },
          )

        const crossRes = await app.inject({
          method: 'DELETE',
          url: `/api/conversions/covers/${coverId}`,
          headers: { authorization: `Bearer ${signToken(otherId)}` },
        })
        expect(crossRes.statusCode).toBe(404)

        const ownerRes = await app.inject({
          method: 'DELETE',
          url: `/api/conversions/covers/${coverId}`,
          headers: { authorization: `Bearer ${signToken(ownerId)}` },
        })
        expect(ownerRes.statusCode).toBe(200)
      } finally {
        await prisma.cover.deleteMany({ where: { coverId } })
        await prisma.source.deleteMany({ where: { sourceId } })
        await prisma.user.deleteMany({ where: { id: { in: [ownerId, otherId] } } })
      }
    })
  })
})
