import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { JWT_AUDIENCE, JWT_ISSUER } from '../../../auth/services/token.service'

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

describe('Upload Cover API E2E', () => {
  let app: FastifyInstance
  let token: string

  beforeEach(async () => {
    const mod = await import('../../../../shared/server')
    app = await mod.createServer()

    token = app.jwt.sign(
      { sub: 'user-test-123' },
      {
        iss: JWT_ISSUER,
        aud: JWT_AUDIENCE,
        expiresIn: '1h',
        jti: 'session-e2e-cover',
      },
    )
  })

  describe('POST /api/conversions/covers/upload', () => {
    it('deve retornar 401 se requisição não estiver autenticada', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/conversions/covers/upload',
        payload: {
          fileName: 'cover.jpg',
          contentType: 'image/jpeg',
          base64Data: hoisted.validJpgBuffer.toString('base64'),
        },
      })
      expect(res.statusCode).toBe(401)
    })

    it('deve retornar 201 com uploadId, name e url para upload autenticado', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/conversions/covers/upload',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          fileName: 'my-custom-cover.jpg',
          contentType: 'image/jpeg',
          base64Data: `data:image/jpeg;base64,${hoisted.validJpgBuffer.toString('base64')}`,
        },
      })

      expect(res.statusCode).toBe(201)
      const body = res.json()
      expect(body.uploadId).toBeDefined()
      expect(body.uploadId).toMatch(/^up_/)
      expect(body.name).toBe('my-custom-cover.jpg')
      expect(body.url).toBe(`/api/conversions/covers/uploaded/${body.uploadId}`)
    })

    it('deve retornar 415 se os bytes não forem uma imagem válida', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/conversions/covers/upload',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          fileName: 'fake.jpg',
          contentType: 'image/jpeg',
          base64Data: Buffer.from('not an image content').toString('base64'),
        },
      })

      expect(res.statusCode).toBe(415)
    })

    it('deve retornar 404 se sourceId informado não existir', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/conversions/covers/upload',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          sourceId: 'src_inexistente_e2e',
          fileName: 'custom.jpg',
          contentType: 'image/jpeg',
          base64Data: hoisted.validJpgBuffer.toString('base64'),
        },
      })

      expect(res.statusCode).toBe(404)
    })
  })

  describe('GET /api/conversions/covers/uploaded/:uploadId', () => {
    it('deve ser acessível publicamente (sem auth) e servir a imagem com Cache-Control', async () => {
      // 1. Faz upload
      const uploadRes = await app.inject({
        method: 'POST',
        url: '/api/conversions/covers/upload',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          fileName: 'public-test.jpg',
          contentType: 'image/jpeg',
          base64Data: hoisted.validJpgBuffer.toString('base64'),
        },
      })

      expect(uploadRes.statusCode).toBe(201)
      const { uploadId } = uploadRes.json()

      // 2. Busca sem auth
      const getRes = await app.inject({
        method: 'GET',
        url: `/api/conversions/covers/uploaded/${uploadId}`,
      })

      expect(getRes.statusCode).toBe(200)
      expect(getRes.headers['content-type']).toContain('image/jpeg')
      expect(getRes.headers['cache-control']).toContain('public')
      expect(getRes.headers['cache-control']).toContain('max-age=86400')
      expect(getRes.rawPayload).toEqual(hoisted.validJpgBuffer)
    })

    it('deve retornar 404 para uploadId inexistente', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/conversions/covers/uploaded/up_inexistente_123',
      })

      expect(res.statusCode).toBe(404)
    })
  })
})
