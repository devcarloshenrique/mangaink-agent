import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { IStatusStore } from '../../../../shared/infra'

const mockStore = {
  get: vi.fn(),
  set: vi.fn().mockResolvedValue(undefined),
  clear: vi.fn().mockResolvedValue(undefined),
}

const mockDefaultStore = {
  get: vi.fn(),
  set: vi.fn().mockResolvedValue(undefined),
  clear: vi.fn().mockResolvedValue(undefined),
}

vi.mock('../../../../shared/infra/redis', () => ({
  RedisStatusStoreAdapter: vi.fn(() => mockDefaultStore),
}))

import {
  setChapterDownloadStatusStore,
  setJobStatus,
  getJobStatus,
} from '../../services/chapter-download-status-store'

describe('chapter-download-status-store com IStatusStore injetado', () => {
  beforeEach(() => {
    mockStore.get.mockReset()
    mockStore.set.mockReset()
    mockStore.clear.mockReset()
    setChapterDownloadStatusStore(mockStore as IStatusStore)
  })

  it('setJobStatus: delega set com chave + merge flat + TTL 86400', async () => {
    await setJobStatus('src-1', 'ch-1', 'job-1', 'downloading')

    expect(mockStore.set).toHaveBeenCalledWith(
      'chapter-download-active:src-1:ch-1',
      { jobId: 'job-1', status: 'downloading' },
      86400,
    )
  })

  it('setJobStatus: inclui error quando informado (motivo da falha)', async () => {
    await setJobStatus('src-1', 'ch-1', 'job-1', 'failed', 'Nenhuma imagem encontrada')

    expect(mockStore.set).toHaveBeenCalledWith(
      'chapter-download-active:src-1:ch-1',
      { jobId: 'job-1', status: 'failed', error: 'Nenhuma imagem encontrada' },
      86400,
    )
  })

  it('getJobStatus: devolve error quando presente no registro', async () => {
    mockStore.get.mockResolvedValue({
      jobId: 'job-1',
      status: 'failed',
      error: 'Capítulo indisponível',
    })

    const result = await getJobStatus('src-1', 'ch-1')

    expect(result).toEqual({
      jobId: 'job-1',
      status: 'failed',
      error: 'Capítulo indisponível',
    })
  })

  it('getJobStatus: devolve { jobId, status } parseado', async () => {
    mockStore.get.mockResolvedValue({ jobId: 'job-1', status: 'completed' })

    const result = await getJobStatus('src-1', 'ch-1')

    expect(result).toEqual({ jobId: 'job-1', status: 'completed' })
    expect(mockStore.get).toHaveBeenCalledWith('chapter-download-active:src-1:ch-1')
  })

  it('getJobStatus: devolve null quando não há registro ativo', async () => {
    mockStore.get.mockResolvedValue(null)

    const result = await getJobStatus('src-1', 'ch-1')

    expect(result).toBeNull()
  })
})

describe('fallback default (sem setter injetado)', () => {
  beforeEach(() => {
    mockDefaultStore.get.mockReset()
    mockDefaultStore.set.mockReset()
    mockDefaultStore.clear.mockReset()
  })

  it('delega para o RedisStatusStoreAdapter default com o mesmo contrato', async () => {
    vi.resetModules()
    const fresh = await import('../../services/chapter-download-status-store')

    await fresh.setJobStatus('src-1', 'ch-1', 'job-1', 'queued')
    expect(mockDefaultStore.set).toHaveBeenCalledWith(
      'chapter-download-active:src-1:ch-1',
      { jobId: 'job-1', status: 'queued' },
      86400,
    )

    mockDefaultStore.get.mockResolvedValue({ jobId: 'job-1', status: 'queued' })
    const result = await fresh.getJobStatus('src-1', 'ch-1')
    expect(result).toEqual({ jobId: 'job-1', status: 'queued' })
    expect(mockDefaultStore.get).toHaveBeenCalledWith('chapter-download-active:src-1:ch-1')
  })
})
