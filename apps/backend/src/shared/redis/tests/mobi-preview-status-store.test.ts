import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { IStatusStore } from '../../infra'
import { InMemoryStatusStore } from '../../infra/inmemory'
import { RedisStatusStoreAdapter } from '../../infra/redis'

const envHolder = vi.hoisted(() => ({
  env: { JOB_STATUS_TTL_SEC: 21600, MI_EMBEDDED_MODE: false },
}))

vi.mock('../../config/env', () => ({ env: envHolder.env }))

import { MobiPreviewStatusStore } from '../mobi-preview-status-store'

function createMockStore() {
  return {
    get: vi.fn(),
    set: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
  }
}

describe('MobiPreviewStatusStore', () => {
  let store: MobiPreviewStatusStore
  let mockStore: ReturnType<typeof createMockStore>

  beforeEach(() => {
    envHolder.env.MI_EMBEDDED_MODE = false
    mockStore = createMockStore()
    store = new MobiPreviewStatusStore(mockStore as IStatusStore)
  })

  it('set: delega para IStatusStore com merge flat + TTL de JOB_STATUS_TTL_SEC', async () => {
    await store.set('job-1', {
      status: 'extracting',
      readyPages: 5,
      totalPages: 20,
      updatedAt: '2024-01-01T00:00:00.000Z',
    })

    expect(mockStore.set).toHaveBeenCalledWith(
      'mobi:preview:status:job-1',
      {
        status: 'extracting',
        readyPages: 5,
        totalPages: 20,
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
      21600,
    )
  })

  it('set: ignora campos undefined ao montar o objeto flat', async () => {
    await store.set('job-1', { status: 'queued', error: undefined })

    expect(mockStore.set).toHaveBeenCalledWith(
      'mobi:preview:status:job-1',
      { status: 'queued' },
      21600,
    )
  })

  it('set: não delega se o partial está vazio', async () => {
    await store.set('job-1', {})

    expect(mockStore.set).not.toHaveBeenCalled()
  })

  it('get: retorna estado tipado com defaults numéricos', async () => {
    mockStore.get.mockResolvedValue({
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
    expect(mockStore.get).toHaveBeenCalledWith('mobi:preview:status:job-1')
  })

  it('get: retorna estado terminal completed', async () => {
    mockStore.get.mockResolvedValue({
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

  it('get: retorna null quando IStatusStore devolve null', async () => {
    mockStore.get.mockResolvedValue(null)

    const result = await store.get('job-1')

    expect(result).toBeNull()
  })

  it('clear: delega para IStatusStore', async () => {
    await store.clear('job-1')

    expect(mockStore.clear).toHaveBeenCalledWith('mobi:preview:status:job-1')
  })
})

describe('MobiPreviewStatusStore default (env-aware)', () => {
  it('MI_EMBEDDED_MODE=true → InMemoryStatusStore e roundtrip sem Redis', async () => {
    envHolder.env.MI_EMBEDDED_MODE = true

    const defaultStore = new MobiPreviewStatusStore()

    expect((defaultStore as unknown as { store: IStatusStore }).store).toBeInstanceOf(InMemoryStatusStore)

    await defaultStore.set('job-x', {
      status: 'extracting',
      readyPages: 5,
      totalPages: 20,
      updatedAt: '2024-01-01T00:00:00.000Z',
    })
    const result = await defaultStore.get('job-x')

    expect(result).not.toBeNull()
    expect(result!.status).toBe('extracting')
    expect(result!.readyPages).toBe(5)
    expect(result!.totalPages).toBe(20)
    expect(result!.updatedAt).toBe('2024-01-01T00:00:00.000Z')

    await defaultStore.clear('job-x')
    expect(await defaultStore.get('job-x')).toBeNull()
  })

  it('sem flag (MI_EMBEDDED_MODE=false) → RedisStatusStoreAdapter lazy, sem conexão', () => {
    envHolder.env.MI_EMBEDDED_MODE = false

    const defaultStore = new MobiPreviewStatusStore()

    expect((defaultStore as unknown as { store: IStatusStore }).store).toBeInstanceOf(RedisStatusStoreAdapter)
  })

  it('injeção explícita sobrepõe o default mesmo com MI_EMBEDDED_MODE=true', () => {
    envHolder.env.MI_EMBEDDED_MODE = true

    const localMock = createMockStore()
    const injectedStore = new MobiPreviewStatusStore(localMock as IStatusStore)

    expect((injectedStore as unknown as { store: IStatusStore }).store).toBe(localMock)
  })
})
