import { describe, expect, it, beforeEach, afterAll } from 'vitest'
import { prisma } from '../../../../shared/database/prisma'
import { PrismaSourceRepository } from '../../repositories/prisma-source.repository'
import type { SourceMetadataFile } from '../../types/metadata.types'

function makeSourcePayload(sourceId: string): SourceMetadataFile {
  const now = new Date().toISOString()
  return {
    sourceId,
    status: 'ready' as const,
    provider: { slug: 'test', name: 'Test Provider', engine: 'cheerio' as const },
    source: { url: 'https://example.com/manga/test/', language: 'pt-br' },
    metadata: {
      title: 'Test Manga',
      author: 'Test Author',
      description: 'Test Description',
      status: 'ongoing',
      genres: ['Action', 'Comedy'],
    },
    chapters: [
      { id: 'ch_test_001', number: '1', title: 'Chapter 1', url: 'https://example.com/manga/test/1', pages: 20, volume: 1 },
      { id: 'ch_test_002', number: '2', title: 'Chapter 2', url: 'https://example.com/manga/test/2', pages: 22, volume: 1 },
    ],
    covers: [
      { id: 'cv_test_001', type: 'original', label: 'Cover 1', imageUrl: 'https://example.com/covers/cover1.jpg' },
    ],
    statistics: { chapters: 2, covers: 1 },
    cache: {
      createdAt: now,
      updatedAt: now,
      lastAccessAt: now,
      cacheTtlHours: 24,
      retentionDays: 30,
    },
  }
}

describe('PrismaSourceRepository', () => {
  let repository: PrismaSourceRepository

  beforeEach(async () => {
    await prisma.chapter.deleteMany()
    await prisma.cover.deleteMany()
    await prisma.source.deleteMany()
    repository = new PrismaSourceRepository()
  })

  afterAll(async () => {
    await prisma.chapter.deleteMany()
    await prisma.cover.deleteMany()
    await prisma.source.deleteMany()
    await prisma.$disconnect()
  })

  describe('exists', () => {
    it('deve retornar false para source inexistente', async () => {
      const result = await repository.exists('src-nonexistent')
      expect(result).toBe(false)
    })

    it('deve retornar true após save', async () => {
      const data = makeSourcePayload('src-test-exists')
      await repository.save('src-test-exists', data)
      const result = await repository.exists('src-test-exists')
      expect(result).toBe(true)
    })
  })

  describe('save + load round-trip', () => {
    it('deve preservar todos os campos: metadata, chapters, covers, statistics, cache', async () => {
      const data = makeSourcePayload('src-test-roundtrip')
      await repository.save('src-test-roundtrip', data)

      const loaded = await repository.load('src-test-roundtrip')
      expect(loaded).not.toBeNull()

      expect(loaded!.sourceId).toBe('src-test-roundtrip')
      expect(loaded!.status).toBe('ready')
      expect(loaded!.provider.slug).toBe('test')
      expect(loaded!.provider.name).toBe('Test Provider')
      expect(loaded!.provider.engine).toBe('cheerio')
      expect(loaded!.source.url).toBe('https://example.com/manga/test/')
      expect(loaded!.source.language).toBe('pt-br')
      expect(loaded!.metadata.title).toBe('Test Manga')
      expect(loaded!.metadata.author).toBe('Test Author')
      expect(loaded!.metadata.description).toBe('Test Description')
      expect(loaded!.metadata.status).toBe('ongoing')
      expect(loaded!.metadata.genres).toEqual(['Action', 'Comedy'])
      expect(loaded!.statistics.chapters).toBe(2)
      expect(loaded!.statistics.covers).toBe(1)
      expect(loaded!.cache.cacheTtlHours).toBe(24)
      expect(loaded!.cache.retentionDays).toBe(30)
    })

    it('deve preservar chapters com ordenacao por number', async () => {
      const data = makeSourcePayload('src-test-chapters')
      await repository.save('src-test-chapters', data)

      const loaded = await repository.load('src-test-chapters')
      expect(loaded!.chapters).toHaveLength(2)
      expect(loaded!.chapters[0].id).toBe('ch_test_001')
      expect(loaded!.chapters[0].number).toBe('1')
      expect(loaded!.chapters[0].title).toBe('Chapter 1')
      expect(loaded!.chapters[0].pages).toBe(20)
      expect(loaded!.chapters[0].volume).toBe(1)
      expect(loaded!.chapters[1].id).toBe('ch_test_002')
    })

    it('deve preservar covers', async () => {
      const data = makeSourcePayload('src-test-covers')
      await repository.save('src-test-covers', data)

      const loaded = await repository.load('src-test-covers')
      expect(loaded!.covers).toHaveLength(1)
      expect(loaded!.covers[0].id).toBe('cv_test_001')
      expect(loaded!.covers[0].type).toBe('original')
      expect(loaded!.covers[0].imageUrl).toBe('https://example.com/covers/cover1.jpg')
    })

    it('deve remover chapters e covers que desapareceram no re-save', async () => {
      const data = makeSourcePayload('src-test-resave')
      await repository.save('src-test-resave', data)

      const modified = { ...data, chapters: [data.chapters[0]], covers: [] }
      await repository.save('src-test-resave', modified)

      const loaded = await repository.load('src-test-resave')
      expect(loaded!.chapters).toHaveLength(1)
      expect(loaded!.chapters[0].id).toBe('ch_test_001')
      expect(loaded!.covers).toHaveLength(0)
    })
  })

  describe('update', () => {
    it('deve atualizar lastAccessAt sem alterar metadata', async () => {
      const data = makeSourcePayload('src-test-update')
      await repository.save('src-test-update', data)

      await repository.update('src-test-update', { lastAccessAt: '2026-07-09T00:00:00Z' })

      const loaded = await repository.load('src-test-update')
      expect(loaded!.cache.lastAccessAt).toMatch(/^2026-07-09T00:00:00/)
      expect(loaded!.metadata.title).toBe('Test Manga')
    })

    it('nao deve lancar erro se source nao existe', async () => {
      await expect(
        repository.update('src-nonexistent', { lastAccessAt: '2026-07-09T00:00:00Z' }),
      ).resolves.toBeUndefined()
    })
  })

  describe('delete', () => {
    it('deve deletar source e cascade chapters/covers', async () => {
      const data = makeSourcePayload('src-test-delete')
      await repository.save('src-test-delete', data)
      expect(await repository.exists('src-test-delete')).toBe(true)

      await repository.delete('src-test-delete')
      expect(await repository.exists('src-test-delete')).toBe(false)

      const chaptersCount = await prisma.chapter.count({ where: { sourceId: 'src-test-delete' } })
      expect(chaptersCount).toBe(0)

      const coversCount = await prisma.cover.count({ where: { sourceId: 'src-test-delete' } })
      expect(coversCount).toBe(0)
    })

    it('nao deve lancar erro se source ja foi deletada', async () => {
      await expect(repository.delete('src-nonexistent')).resolves.toBeUndefined()
    })
  })

  describe('load', () => {
    it('deve retornar null para source inexistente', async () => {
      const result = await repository.load('src-nonexistent')
      expect(result).toBeNull()
    })
  })

  describe('placeholders', () => {
    it('deve retornar array vazio quando chapter nao tem placeholders', async () => {
      const data = makeSourcePayload('src-test-placeholders')
      await repository.save('src-test-placeholders', data)

      const indices = await repository.getPlaceholderIndices('src-test-placeholders', 'ch_test_001')
      expect(indices).toEqual([])
    })

    it('deve gravar e ler placeholderIndices round-trip', async () => {
      const data = makeSourcePayload('src-test-plh-roundtrip')
      await repository.save('src-test-plh-roundtrip', data)

      await repository.updatePlaceholderIndices('src-test-plh-roundtrip', 'ch_test_001', [3, 7, 12])

      const indices = await repository.getPlaceholderIndices('src-test-plh-roundtrip', 'ch_test_001')
      expect(indices).toEqual([3, 7, 12])
    })

    it('deve sobrescrever placeholders existentes', async () => {
      const data = makeSourcePayload('src-test-plh-overwrite')
      await repository.save('src-test-plh-overwrite', data)

      await repository.updatePlaceholderIndices('src-test-plh-overwrite', 'ch_test_001', [1, 2])
      await repository.updatePlaceholderIndices('src-test-plh-overwrite', 'ch_test_001', [5, 6])

      const indices = await repository.getPlaceholderIndices('src-test-plh-overwrite', 'ch_test_001')
      expect(indices).toEqual([5, 6])
    })

    it('getPlaceholderIndices retorna [] para chapter inexistente', async () => {
      const indices = await repository.getPlaceholderIndices('src-nonexistent', 'ch_nonexistent')
      expect(indices).toEqual([])
    })
  })
})
