import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockHset = vi.fn().mockResolvedValue('OK')
const mockHgetall = vi.fn()
const mockDel = vi.fn().mockResolvedValue(1)
const mockExpire = vi.fn().mockResolvedValue(1)
const mockIncr = vi.fn().mockResolvedValue(1)
const mockPublish = vi.fn().mockResolvedValue(1)

vi.mock('../redis', () => ({
  getRedis: () => ({
    hset: mockHset,
    hgetall: mockHgetall,
    del: mockDel,
    expire: mockExpire,
    incr: mockIncr,
    publish: mockPublish,
  }),
  closeRedis: vi.fn(),
}))

vi.mock('../../config/env', () => ({
  env: {
    JOB_STATUS_TTL_SEC: 21600,
    REDIS_URL: 'redis://localhost:6379',
    NODE_ENV: 'test',
    PORT: 3333,
    JWT_SECRET: 'test-secret',
    DATABASE_URL: 'postgresql://test',
    STORAGE_PATH: './storage',
    KCC_DOCKER_IMAGE: 'mangaink-kcc:10.3.0',
    CONVERSIONS_STORAGE_PATH: './storage/conversions',
    MOBI_DOCKER_IMAGE: 'mangaink-unpack:0.4.1',
    MOBI_PREVIEW_TTL_SEC: 86400,
  },
}))

import { MobiPreviewStatusStore } from '../mobi-preview-status-store'

describe('MobiPreviewStatusStore', () => {
  let store: MobiPreviewStatusStore

  beforeEach(() => {
    store = new MobiPreviewStatusStore()
    mockHset.mockClear()
    mockHgetall.mockClear()
    mockDel.mockClear()
    mockExpire.mockClear()
    mockIncr.mockClear()
    mockPublish.mockClear()
  })

  it('set: HSET + EXPIRE com TTL de JOB_STATUS_TTL_SEC', async () => {
    await store.set('job-1', {
      status: 'extracting',
      readyPages: 5,
      totalPages: 20,
      updatedAt: '2024-01-01T00:00:00.000Z',
    })

    expect(mockHset).toHaveBeenCalledWith(
      'mobi:preview:status:job-1',
      'status',
      'extracting',
      'readyPages',
      '5',
      'totalPages',
      '20',
      'updatedAt',
      '2024-01-01T00:00:00.000Z',
    )
    expect(mockExpire).toHaveBeenCalledWith('mobi:preview:status:job-1', 21600)
  })

  it('set: serializa completedAt e error opcionais', async () => {
    await store.set('job-1', {
      status: 'failed',
      error: 'docker not found',
      updatedAt: '2024-01-01T00:00:00.000Z',
    })

    expect(mockHset).toHaveBeenCalledWith(
      'mobi:preview:status:job-1',
      'status',
      'failed',
      'error',
      'docker not found',
      'updatedAt',
      '2024-01-01T00:00:00.000Z',
    )
  })

  it('set: ignora campos undefined', async () => {
    await store.set('job-1', { status: 'queued', error: undefined })

    expect(mockHset).toHaveBeenCalledWith(
      'mobi:preview:status:job-1',
      'status',
      'queued',
    )
  })

  it('set: não chama HSET se partial vazio', async () => {
    await store.set('job-1', {})

    expect(mockHset).not.toHaveBeenCalled()
  })

  it('get: retorna estado tipado com defaults numéricos', async () => {
    mockHgetall.mockResolvedValue({
      status: 'extracting',
      readyPages: '5',
      totalPages: '20',
      updatedAt: '2024-01-01T00:00:00.000Z',
    })

    const result = await store.get('job-1')

    expect(result).not.toBeNull()
    expect(result!.status).toBe('extracting')
    expect(result!.readyPages).toBe(5)
    expect(result!.totalPages).toBe(20)
    expect(result!.updatedAt).toBe('2024-01-01T00:00:00.000Z')
    expect(result!.currentStep).toBe('')
    expect(result!.completedAt).toBeUndefined()
    expect(result!.error).toBeUndefined()
    expect(mockHgetall).toHaveBeenCalledWith('mobi:preview:status:job-1')
  })

  it('get: retorna estado terminal completed', async () => {
    mockHgetall.mockResolvedValue({
      status: 'ready',
      readyPages: '20',
      totalPages: '20',
      updatedAt: '2024-01-01T00:00:00.000Z',
      completedAt: '2024-01-01T00:05:00.000Z',
    })

    const result = await store.get('job-1')

    expect(result).not.toBeNull()
    expect(result!.status).toBe('ready')
    expect(result!.completedAt).toBe('2024-01-01T00:05:00.000Z')
  })

  it('get: retorna null se chave não existe', async () => {
    mockHgetall.mockResolvedValue({})

    const result = await store.get('job-1')

    expect(result).toBeNull()
  })

  it('clear: DEL a chave correta', async () => {
    await store.clear('job-1')

    expect(mockDel).toHaveBeenCalledWith('mobi:preview:status:job-1')
  })
})