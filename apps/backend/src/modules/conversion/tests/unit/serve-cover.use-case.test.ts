import { describe, it, expect, vi } from 'vitest'

const hoisted = vi.hoisted(() => {
  const { tmpdir } = require('node:os')
  const { randomUUID } = require('node:crypto')
  const { join } = require('node:path')
  const STORAGE_BASE = join(tmpdir(), 'mangaink-test-cover', randomUUID())
  return { STORAGE_BASE, join }
})

vi.mock('../../../../shared/utils/filesystem', () => ({
  pathExists: vi.fn(async () => true),
  mkdirp: vi.fn(),
  readJson: vi.fn(),
  writeJson: vi.fn(),
}))

vi.mock('../../../../shared/config/env', () => ({
  env: {
    STORAGE_PATH: hoisted.STORAGE_BASE,
    CONVERSIONS_STORAGE_PATH: hoisted.join(hoisted.STORAGE_BASE, 'conversions'),
    NODE_ENV: 'test',
    PORT: 3333,
    JWT_SECRET: 'test',
    DATABASE_URL: 'postgres://test',
    REDIS_URL: 'redis://test',
    KCC_DOCKER_IMAGE: 'kcc:test',
  },
}))

vi.mock('../../../scraping/utils/resolve-provider', () => ({
  resolveProvider: vi.fn(async () => null),
}))

import { ServeCoverUseCase } from '../../use-cases/serve-cover.use-case'
import type { SourceCacheRepository } from '../../../scraping/repositories/source-cache.repository'
import type { SourceMetadataFile } from '../../../scraping/types/metadata.types'

function makeSource(overrides: Partial<SourceMetadataFile> = {}): SourceMetadataFile {
  return {
    sourceId: 'src-test-001',
    status: 'ready',
    provider: { slug: 'test', name: 'Test', engine: 'cheerio' },
    source: { url: 'https://test.example.com/manga/test/', language: 'pt-BR' },
    metadata: { title: 'Test', author: null, description: null, status: null, genres: [] },
    chapters: [
      {
        id: 'chap_0001',
        number: '1',
        title: 'Cap 1',
        url: 'https://test.example.com/ch/1',
        pages: 20,
        volume: 1,
        isDownloaded: false,
      },
    ],
    covers: [
      {
        id: 'cover_001',
        type: 'original',
        label: 'Original',
        imageUrl: 'https://img.example.com/cover.jpg',
      },
    ],
    statistics: { chapters: 1, covers: 1 },
    cache: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastAccessAt: new Date().toISOString(),
      cacheTtlHours: 24,
      retentionDays: 30,
    },
    ...overrides,
  }
}

describe('ServeCoverUseCase', () => {
  it('retorna filePath para capa cacheda em disco', async () => {
    const source = makeSource()
    const repo = {
      load: vi.fn(async () => source),
    } as unknown as SourceCacheRepository
    const useCase = new ServeCoverUseCase(repo)

    const result = await useCase.execute('src-test-001', 'cover_001')

    const expectedPath = hoisted.join(
      hoisted.STORAGE_BASE,
      'sources',
      'src-test-001',
      'covers',
      'cover_001.jpg',
    )
    expect(result.filePath).toBe(expectedPath)
    expect(result.contentType).toMatch(/image\/(jpeg|png|webp)/)
  })

  it('resolve alias "original" para o cover.id real no path', async () => {
    const source = makeSource()
    const repo = {
      load: vi.fn(async () => source),
    } as unknown as SourceCacheRepository
    const useCase = new ServeCoverUseCase(repo)

    const result = await useCase.execute('src-test-001', 'original')

    const expectedPath = hoisted.join(
      hoisted.STORAGE_BASE,
      'sources',
      'src-test-001',
      'covers',
      'cover_001.jpg',
    )
    expect(result.filePath).toBe(expectedPath)
  })

  it('lanca erro para source inexistente e sem cache em disco', async () => {
    const { readdir } = await import('node:fs/promises')
    const repo = {
      load: vi.fn(async () => null),
    } as unknown as SourceCacheRepository
    const useCase = new ServeCoverUseCase(repo)

    await expect(useCase.execute('src-nonexistent', 'cover_001')).rejects.toThrow('encontrada')
  })

  it('lanca erro para cover nao encontrado', async () => {
    const source = makeSource()
    const repo = {
      load: vi.fn(async () => source),
    } as unknown as SourceCacheRepository
    const useCase = new ServeCoverUseCase(repo)

    await expect(useCase.execute('src-test-001', 'cover_999')).rejects.toThrow('encontrada')
  })

  it('lanca erro para URL de capa malformada', async () => {
    const source = makeSource({
      covers: [
        {
          id: 'cover_001',
          type: 'original' as const,
          label: 'Original',
          imageUrl: 'not a valid url',
        },
      ],
    })
    const repo = {
      load: vi.fn(async () => source),
    } as unknown as SourceCacheRepository
    const useCase = new ServeCoverUseCase(repo)

    await expect(useCase.execute('src-test-001', 'cover_001')).rejects.toThrow('URL de capa inválida')
  })
})
