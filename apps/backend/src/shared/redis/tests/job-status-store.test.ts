import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockHset = vi.fn().mockResolvedValue('OK')
const mockHgetall = vi.fn()
const mockDel = vi.fn().mockResolvedValue(1)
const mockExpire = vi.fn().mockResolvedValue(1)

vi.mock('../redis', () => ({
  getRedis: () => ({
    hset: mockHset,
    hgetall: mockHgetall,
    del: mockDel,
    expire: mockExpire,
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
    REPO_BACKEND: 'filesystem',
  },
}))

import { JobLiveStatusStore } from '../job-status-store'

describe('JobLiveStatusStore', () => {
  let store: JobLiveStatusStore

  beforeEach(() => {
    store = new JobLiveStatusStore()
    mockHset.mockClear()
    mockHgetall.mockClear()
    mockDel.mockClear()
    mockExpire.mockClear()
  })

  it('set: HSET + EXPIRE com TTL correto', async () => {
    await store.set('job-1', {
      status: 'preparing',
      currentStep: 'Preparing...',
      updatedAt: '2024-01-01T00:00:00.000Z',
    })

    expect(mockHset).toHaveBeenCalledWith(
      'conv:status:job-1',
      'status',
      'preparing',
      'currentStep',
      'Preparing...',
      'updatedAt',
      '2024-01-01T00:00:00.000Z',
    )
    expect(mockExpire).toHaveBeenCalledWith('conv:status:job-1', 21600)
  })

  it('set: ignora campos undefined', async () => {
    await store.set('job-1', { status: 'downloading', progress: undefined })

    expect(mockHset).toHaveBeenCalledWith(
      'conv:status:job-1',
      'status',
      'downloading',
    )
  })

  it('set: não chama HSET se partial vazio', async () => {
    await store.set('job-1', {})

    expect(mockHset).not.toHaveBeenCalled()
  })

  it('get: retorna objeto tipado se chave existe', async () => {
    mockHgetall.mockResolvedValue({
      status: 'downloading',
      currentStep: 'Downloading...',
      progress: '42',
      downloadedImages: '10',
      totalImages: '20',
      updatedAt: '2024-01-01T00:00:00.000Z',
    })

    const result = await store.get('job-1')

    expect(result).toEqual({
      status: 'downloading',
      currentStep: 'Downloading...',
      progress: 42,
      downloadedImages: 10,
      totalImages: 20,
      updatedAt: '2024-01-01T00:00:00.000Z',
    })
    expect(mockHgetall).toHaveBeenCalledWith('conv:status:job-1')
  })

  it('get: retorna null se chave não existe', async () => {
    mockHgetall.mockResolvedValue({})

    const result = await store.get('job-1')

    expect(result).toBeNull()
  })

  it('get: parseia campos numéricos a partir de strings', async () => {
    mockHgetall.mockResolvedValue({
      status: 'completed',
      progress: '0',
      downloadedImages: '0',
      totalImages: '0',
      outputSize: '1024000',
    })

    const result = await store.get('job-1')

    expect(result).not.toBeNull()
    expect(result!.downloadedImages).toBe(0)
    expect(result!.totalImages).toBe(0)
    expect(result!.outputSize).toBe(1024000)
  })

  it('clear: DEL a chave correta', async () => {
    await store.clear('job-1')

    expect(mockDel).toHaveBeenCalledWith('conv:status:job-1')
  })

  it('TTL renovado em cada set', async () => {
    await store.set('job-1', { status: 'preparing', updatedAt: '2024-01-01T00:00:00.000Z' })
    expect(mockExpire).toHaveBeenCalledWith('conv:status:job-1', 21600)
    mockExpire.mockClear()

    await store.set('job-1', { status: 'downloading', updatedAt: '2024-01-01T00:00:00.000Z' })
    expect(mockExpire).toHaveBeenCalledWith('conv:status:job-1', 21600)
  })

  it('get: campos opcionais retornam undefined quando ausentes', async () => {
    mockHgetall.mockResolvedValue({
      status: 'queued',
      currentStep: '',
      progress: '0',
      downloadedImages: '0',
      totalImages: '0',
      updatedAt: '2024-01-01T00:00:00.000Z',
    })

    const result = await store.get('job-1')

    expect(result).not.toBeNull()
    expect(result!.completedAt).toBeUndefined()
    expect(result!.downloadUrl).toBeUndefined()
    expect(result!.outputFile).toBeUndefined()
    expect(result!.outputSize).toBeUndefined()
    expect(result!.error).toBeUndefined()
  })
})
