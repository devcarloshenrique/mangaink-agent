import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { IStatusStore } from '../../infra'
import { InMemoryStatusStore } from '../../infra/inmemory'
import { RedisStatusStoreAdapter } from '../../infra/redis'

const envHolder = vi.hoisted(() => ({
  env: { JOB_STATUS_TTL_SEC: 21600, MI_EMBEDDED_MODE: false },
}))

vi.mock('../../config/env', () => ({ env: envHolder.env }))

import { JobLiveStatusStore } from '../job-status-store'

function createMockStore() {
  return {
    get: vi.fn(),
    set: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
  }
}

describe('JobLiveStatusStore', () => {
  let store: JobLiveStatusStore
  let mockStore: ReturnType<typeof createMockStore>

  beforeEach(() => {
    envHolder.env.MI_EMBEDDED_MODE = false
    mockStore = createMockStore()
    store = new JobLiveStatusStore(mockStore as IStatusStore)
  })

  it('set: delega para IStatusStore com merge flat + TTL de JOB_STATUS_TTL_SEC', async () => {
    await store.set('job-1', {
      status: 'preparing',
      currentStep: 'Preparing...',
      updatedAt: '2024-01-01T00:00:00.000Z',
    })

    expect(mockStore.set).toHaveBeenCalledWith(
      'conv:status:job-1',
      {
        status: 'preparing',
        currentStep: 'Preparing...',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
      21600,
    )
  })

  it('set: ignora campos undefined ao montar o objeto flat', async () => {
    await store.set('job-1', { status: 'downloading', progress: undefined })

    expect(mockStore.set).toHaveBeenCalledWith(
      'conv:status:job-1',
      { status: 'downloading' },
      21600,
    )
  })

  it('set: não delega se o partial está vazio', async () => {
    await store.set('job-1', {})

    expect(mockStore.set).not.toHaveBeenCalled()
  })

  it('get: retorna objeto tipado se a chave existe', async () => {
    mockStore.get.mockResolvedValue({
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
    expect(mockStore.get).toHaveBeenCalledWith('conv:status:job-1')
  })

  it('get: retorna null quando IStatusStore devolve null', async () => {
    mockStore.get.mockResolvedValue(null)

    const result = await store.get('job-1')

    expect(result).toBeNull()
  })

  it('get: parseia campos numéricos a partir de strings', async () => {
    mockStore.get.mockResolvedValue({
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

  it('get: campos opcionais retornam undefined quando ausentes', async () => {
    mockStore.get.mockResolvedValue({
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

  it('clear: delega para IStatusStore', async () => {
    await store.clear('job-1')

    expect(mockStore.clear).toHaveBeenCalledWith('conv:status:job-1')
  })
})

describe('JobLiveStatusStore default (env-aware)', () => {
  it('MI_EMBEDDED_MODE=true → InMemoryStatusStore e roundtrip sem Redis', async () => {
    envHolder.env.MI_EMBEDDED_MODE = true

    const defaultStore = new JobLiveStatusStore()

    expect((defaultStore as unknown as { store: IStatusStore }).store).toBeInstanceOf(InMemoryStatusStore)

    await defaultStore.set('job-x', {
      status: 'downloading',
      currentStep: 'Downloading...',
      progress: 42,
      downloadedImages: 5,
      totalImages: 10,
      updatedAt: '2024-01-01T00:00:00.000Z',
    })
    const result = await defaultStore.get('job-x')

    expect(result).not.toBeNull()
    expect(result!.status).toBe('downloading')
    expect(result!.currentStep).toBe('Downloading...')
    expect(result!.progress).toBe(42)
    expect(result!.downloadedImages).toBe(5)
    expect(result!.totalImages).toBe(10)
    expect(result!.updatedAt).toBe('2024-01-01T00:00:00.000Z')

    await defaultStore.clear('job-x')
    expect(await defaultStore.get('job-x')).toBeNull()
  })

  it('sem flag (MI_EMBEDDED_MODE=false) → RedisStatusStoreAdapter lazy, sem conexão', () => {
    envHolder.env.MI_EMBEDDED_MODE = false

    const defaultStore = new JobLiveStatusStore()

    expect((defaultStore as unknown as { store: IStatusStore }).store).toBeInstanceOf(RedisStatusStoreAdapter)
  })

  it('injeção explícita sobrepõe o default mesmo com MI_EMBEDDED_MODE=true', () => {
    envHolder.env.MI_EMBEDDED_MODE = true

    const localMock = createMockStore()
    const injectedStore = new JobLiveStatusStore(localMock as IStatusStore)

    expect((injectedStore as unknown as { store: IStatusStore }).store).toBe(localMock)
  })
})
