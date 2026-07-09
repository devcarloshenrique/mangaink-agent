import { describe, expect, it, beforeEach, afterAll } from 'vitest'
import { FilesystemSourceRepository } from '../../repositories/filesystem-source.repository'
import path from 'node:path'
import fs from 'node:fs/promises'
import os from 'node:os'

const testStorageDir = path.join(os.tmpdir(), `mangaink-test-repo-${Date.now()}`)

describe('FilesystemSourceRepository', () => {
  let repository: FilesystemSourceRepository

  beforeEach(() => {
    process.env.STORAGE_PATH = testStorageDir
    // Reset module cache to pick up new env
    vi.resetModules()
  })

  afterAll(async () => {
    await fs.rm(testStorageDir, { recursive: true, force: true })
  })

  const makeMetadata = () => ({
    sourceId: 'src-test-12345678',
    status: 'ready' as const,
    provider: { slug: 'test', name: 'Test', engine: 'cheerio' as const },
    source: { url: 'https://example.com/manga/test/', language: null },
    metadata: { title: 'Test', author: null, description: null, status: null, genres: [] },
    chapters: [],
    covers: [],
    statistics: { chapters: 0, covers: 0 },
    cache: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastAccessAt: new Date().toISOString(),
      cacheTtlHours: 24,
      retentionDays: 30,
    },
  })

  it('exists deve retornar false quando source não existe', async () => {
    const { FilesystemSourceRepository: Repo } = await import('../../repositories/filesystem-source.repository')
    repository = new Repo()
    const result = await repository.exists('src-nonexistent')
    expect(result).toBe(false)
  })

  it('save deve criar metadata.json e diretórios', async () => {
    const { FilesystemSourceRepository: Repo } = await import('../../repositories/filesystem-source.repository')
    repository = new Repo()
    const data = makeMetadata()
    await repository.save('src-test-12345678', data)

    const exists = await repository.exists('src-test-12345678')
    expect(exists).toBe(true)
  })

  it('load deve retornar dados salvos', async () => {
    const { FilesystemSourceRepository: Repo } = await import('../../repositories/filesystem-source.repository')
    repository = new Repo()
    const data = makeMetadata()
    await repository.save('src-test-12345678', data)

    const loaded = await repository.load('src-test-12345678')
    expect(loaded).not.toBeNull()
    expect(loaded?.sourceId).toBe('src-test-12345678')
    expect(loaded?.metadata.title).toBe('Test')
  })

  it('load deve retornar null para source inexistente', async () => {
    const { FilesystemSourceRepository: Repo } = await import('../../repositories/filesystem-source.repository')
    repository = new Repo()
    const result = await repository.load('src-nonexistent')
    expect(result).toBeNull()
  })

  it('update deve modificar apenas campos de cache', async () => {
    const { FilesystemSourceRepository: Repo } = await import('../../repositories/filesystem-source.repository')
    repository = new Repo()
    const data = makeMetadata()
    await repository.save('src-test-12345678', data)

    await repository.update('src-test-12345678', { lastAccessAt: '2026-07-09T00:00:00Z' })

    const loaded = await repository.load('src-test-12345678')
    expect(loaded?.cache.lastAccessAt).toBe('2026-07-09T00:00:00Z')
    expect(loaded?.metadata.title).toBe('Test')
  })

  it('update não deve lançar erro quando source não existe', async () => {
    const { FilesystemSourceRepository: Repo } = await import('../../repositories/filesystem-source.repository')
    repository = new Repo()
    await expect(repository.update('src-nonexistent', { lastAccessAt: '2026-07-09T00:00:00Z' })).resolves.toBeUndefined()
  })

  it('delete deve remover diretório da source', async () => {
    const { FilesystemSourceRepository: Repo } = await import('../../repositories/filesystem-source.repository')
    repository = new Repo()
    const data = makeMetadata()
    await repository.save('src-test-12345678', data)
    await repository.delete('src-test-12345678')

    const exists = await repository.exists('src-test-12345678')
    expect(exists).toBe(false)
  })
})