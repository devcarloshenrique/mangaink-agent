import { describe, expect, it, beforeEach, vi } from 'vitest'
import type { IProviderStrategy } from '../../interfaces/provider-strategy.interface'
import * as resolveProviderModule from '../../utils/resolve-provider'

// Mock do repositorio
const mockLoad = vi.fn()

vi.mock('../../../../shared/database/repositories', () => ({
  getSourceRepository: () => ({
    load: mockLoad,
  }),
}))

// Mock do ProviderResolver
const mockResolve = vi.fn()
const mockRefresh = vi.fn()
const mockLoadFromProviders = vi.fn()
const mockSlug = 'test-provider'

vi.mock('../../providers/provider-resolver', () => ({
  ProviderResolver: vi.fn().mockImplementation(() => ({
    resolve: mockResolve,
    refresh: mockRefresh,
    loadFromProviders: mockLoadFromProviders,
  })),
}))

describe('resolveProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resolveProviderModule.resetProviderResolver()
  })

  it('deve retornar o provider quando source existe e tem chapters com url', async () => {
    const mockProvider = { slug: mockSlug } as IProviderStrategy
    mockLoad.mockResolvedValue({
      sourceId: 'src-test',
      chapters: [{ id: 'chap_0001', url: 'https://test.com/manga/test/chap1/', number: '1', title: 'Cap 1', pages: null, volume: null, isDownloaded: false }],
    })
    mockResolve.mockReturnValue(mockProvider)

    const result = await resolveProviderModule.resolveProvider('src-test')

    expect(result).toBe(mockProvider)
    expect(mockLoad).toHaveBeenCalledWith('src-test')
    expect(mockResolve).toHaveBeenCalledWith('https://test.com/manga/test/chap1/')
  })

  it('deve retornar null quando source nao existe', async () => {
    mockLoad.mockResolvedValue(null)

    const result = await resolveProviderModule.resolveProvider('src-nonexistent')

    expect(result).toBeNull()
    expect(mockLoad).toHaveBeenCalledWith('src-nonexistent')
    expect(mockResolve).not.toHaveBeenCalled()
  })

  it('deve retornar null quando source nao tem chapters', async () => {
    mockLoad.mockResolvedValue({
      sourceId: 'src-test',
      chapters: [],
    })

    const result = await resolveProviderModule.resolveProvider('src-test')

    expect(result).toBeNull()
    expect(mockResolve).not.toHaveBeenCalled()
  })

  it('deve retornar null quando primeiro chapter nao tem url', async () => {
    mockLoad.mockResolvedValue({
      sourceId: 'src-test',
      chapters: [{ id: 'chap_0001', url: '', number: '1', title: 'Cap 1', pages: null, volume: null, isDownloaded: false }],
    })

    const result = await resolveProviderModule.resolveProvider('src-test')

    expect(result).toBeNull()
    expect(mockResolve).not.toHaveBeenCalled()
  })

  describe('getProviderResolver', () => {
    it('retorna a mesma instância (singleton)', () => {
      const first = resolveProviderModule.getProviderResolver()
      const second = resolveProviderModule.getProviderResolver()

      expect(first).toBe(second)
    })
  })

  describe('refreshProviderResolver', () => {
    it('recarrega o resolver (refresh) no singleton', () => {
      resolveProviderModule.refreshProviderResolver()

      expect(mockRefresh).toHaveBeenCalled()
    })

    it('opera sobre a mesma instância do singleton', () => {
      const resolver = resolveProviderModule.getProviderResolver()

      resolveProviderModule.refreshProviderResolver()

      expect(mockRefresh).toHaveBeenCalled()
      expect(resolveProviderModule.getProviderResolver()).toBe(resolver)
    })
  })

  describe('resetProviderResolver', () => {
    it('descarta a instância do singleton', () => {
      const first = resolveProviderModule.getProviderResolver()

      resolveProviderModule.resetProviderResolver()

      const second = resolveProviderModule.getProviderResolver()
      expect(second).not.toBe(first)
    })
  })
})
