import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'

vi.mock('../../../../shared/database/repositories', () => ({
  getConversionRepository: vi.fn(() => ({
    create: vi.fn(), findById: vi.fn(), update: vi.fn(), syncStatus: vi.fn(),
    listJobIds: vi.fn(), appendLog: vi.fn(), delete: vi.fn(),
  })),
  getConversionJobRepository: vi.fn(),
  getSourceRepository: vi.fn(),
}))

vi.mock('../../services/conversion-pubsub.service', () => ({
  ConversionPubSubService: vi.fn(() => ({
    publish: vi.fn(), subscribe: vi.fn(), subscribeMany: vi.fn(),
    unsubscribe: vi.fn(), unsubscribeMany: vi.fn(), close: vi.fn(),
  })),
}))

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

let app: FastifyInstance

beforeEach(async () => {
  const mod = await import('../../../../shared/server')
  app = await mod.createServer()
})

describe('Conversion API E2E', () => {
  it('GET /api/conversions/options → 200 com catálogo completo', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/conversions/options' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.devices.length).toBeGreaterThanOrEqual(5)
    expect(body.formats.length).toBeGreaterThanOrEqual(2)
    expect(body.fields.length).toBeGreaterThanOrEqual(10)
    expect(body.presets.length).toBeGreaterThanOrEqual(2)
  })

  it('options não deve conter batchSplit nem fileFusion nos fields', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/conversions/options' })
    const fieldIds = res.json().fields.map((f: any) => f.id)
    expect(fieldIds).not.toContain('batchSplit')
    expect(fieldIds).not.toContain('fileFusion')
  })

  it('presets não devem conter batchSplit nem fileFusion', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/conversions/options' })
    const presets = res.json().presets
    for (const p of presets) {
      expect(Object.keys(p.values)).not.toContain('batchSplit')
      expect(Object.keys(p.values)).not.toContain('fileFusion')
    }
  })

  it('formats deve ter EPUB como default', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/conversions/options' })
    const epub = res.json().formats.find((f: any) => f.id === 'EPUB')
    expect(epub).toBeDefined()
    expect(epub.default).toBe(true)
  })

  it('formats NÃO deve conter KFX (requer Kindle Previewer — fora de escopo)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/conversions/options' })
    const formatIds = res.json().formats.map((f: any) => f.id)
    expect(formatIds).not.toContain('KFX')
  })
})
