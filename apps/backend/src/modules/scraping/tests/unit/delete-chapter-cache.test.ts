import { describe, expect, it, beforeEach, vi } from 'vitest'
import type { FastifyRequest, FastifyReply } from 'fastify'
import { createBatchDeleteChapterCacheController } from '../../controllers/batch-delete-chapter-cache.controller'
import { createDeleteChapterCacheController } from '../../controllers/delete-chapter-cache.controller'
import { SourceNotFoundError, ProviderNotFoundError } from '../../errors/scraping.errors'

const mockSourceRepo = vi.hoisted(() => ({
  load: vi.fn(),
}))

const mockResolver = vi.hoisted(() => ({
  listAll: vi.fn(),
}))

const mockChapterService = vi.hoisted(() => ({
  deleteCache: vi.fn(),
}))

const mockNotifications = vi.hoisted(() => ({
  notify: vi.fn(),
}))

vi.mock('../../repositories/prisma-source.repository', () => ({
  PrismaSourceRepository: vi.fn(() => mockSourceRepo),
}))

vi.mock('../../utils/resolve-provider', () => ({
  getProviderResolver: () => mockResolver,
}))

vi.mock('../../services/chapter-image.service', () => ({
  ChapterImageService: vi.fn(() => mockChapterService),
}))

vi.mock('../../../../shared/database/repositories', () => ({
  getNotificationRepository: vi.fn(() => ({})),
}))

vi.mock('../../../notification/services/notification.service', () => ({
  createNotificationService: vi.fn(() => mockNotifications),
}))

describe('Delete Chapter Cache Controllers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createBatchDeleteChapterCacheController', () => {
    it('deve lançar SourceNotFoundError quando source não existe', async () => {
      mockSourceRepo.load.mockResolvedValue(null)
      const controller = createBatchDeleteChapterCacheController()

      const req = {
        params: { sourceId: 'src-123' },
        body: { chapterIds: ['ch-1', 'ch-2'] },
        user: { sub: 'user-1' },
      } as unknown as FastifyRequest

      const reply = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn(),
      } as unknown as FastifyReply

      await expect(controller(req, reply)).rejects.toThrow(SourceNotFoundError)
    })

    it('deve lançar ProviderNotFoundError quando provider não existe', async () => {
      mockSourceRepo.load.mockResolvedValue({
        provider: { slug: 'unknown' },
        source: { url: 'https://test.com/manga' },
      })
      mockResolver.listAll.mockReturnValue([])
      const controller = createBatchDeleteChapterCacheController()

      const req = {
        params: { sourceId: 'src-123' },
        body: { chapterIds: ['ch-1'] },
        user: { sub: 'user-1' },
      } as unknown as FastifyRequest

      const reply = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn(),
      } as unknown as FastifyReply

      await expect(controller(req, reply)).rejects.toThrow(ProviderNotFoundError)
    })

    it('deve apagar capítulos em lote e emitir notificação no sininho', async () => {
      mockSourceRepo.load.mockResolvedValue({
        provider: { slug: 'mangalivre' },
        source: { url: 'https://mangalivre.net/manga/test' },
        metadata: { title: 'Naruto' },
      })
      mockResolver.listAll.mockReturnValue([{ slug: 'mangalivre' }])
      mockChapterService.deleteCache
        .mockResolvedValueOnce({ deleted: true })
        .mockResolvedValueOnce({ deleted: true })

      const controller = createBatchDeleteChapterCacheController()

      const req = {
        params: { sourceId: 'src-naruto' },
        body: { chapterIds: ['ch-1', 'ch-2'] },
        user: { sub: 'user-1' },
      } as unknown as FastifyRequest

      const reply = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn(),
      } as unknown as FastifyReply

      await controller(req, reply)

      expect(mockChapterService.deleteCache).toHaveBeenCalledTimes(2)
      expect(mockNotifications.notify).toHaveBeenCalledWith('user-1', {
        type: 'chapter_cache_deleted',
        title: '"Naruto" — capítulos apagados',
        message: '2 capítulo(s) apagado(s) do disco',
        metadata: {
          sourceId: 'src-naruto',
          successfulChapters: 2,
        },
      })
      expect(reply.code).toHaveBeenCalledWith(200)
      expect(reply.send).toHaveBeenCalledWith({
        deletedCount: 2,
        totalCount: 2,
        alreadyCleanCount: 0,
        failedCount: 0,
      })
    })

    it('deve ignorar silenciosamente quando o cache não existir (already clean) e notificar somente os apagados', async () => {
      mockSourceRepo.load.mockResolvedValue({
        provider: { slug: 'mangalivre' },
        source: { url: 'https://mangalivre.net/manga/test' },
        metadata: { title: 'One Piece' },
      })
      mockResolver.listAll.mockReturnValue([{ slug: 'mangalivre' }])
      mockChapterService.deleteCache
        .mockResolvedValueOnce({ deleted: true })
        .mockResolvedValueOnce({ deleted: false, reason: 'cache_not_found' })

      const controller = createBatchDeleteChapterCacheController()

      const req = {
        params: { sourceId: 'src-op' },
        body: { chapterIds: ['ch-1', 'ch-2'] },
        user: { sub: 'user-2' },
      } as unknown as FastifyRequest

      const reply = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn(),
      } as unknown as FastifyReply

      await controller(req, reply)

      expect(mockNotifications.notify).toHaveBeenCalledWith('user-2', {
        type: 'chapter_cache_deleted',
        title: '"One Piece" — capítulos apagados',
        message: '1 capítulo(s) apagado(s) do disco',
        metadata: {
          sourceId: 'src-op',
          successfulChapters: 1,
        },
      })
      expect(reply.send).toHaveBeenCalledWith({
        deletedCount: 1,
        totalCount: 2,
        alreadyCleanCount: 1,
        failedCount: 0,
      })
    })

    it('deve notificar falhas apenas quando houver erro de exceção', async () => {
      mockSourceRepo.load.mockResolvedValue({
        provider: { slug: 'mangalivre' },
        source: { url: 'https://mangalivre.net/manga/test' },
        metadata: { title: 'Bleach' },
      })
      mockResolver.listAll.mockReturnValue([{ slug: 'mangalivre' }])
      mockChapterService.deleteCache
        .mockResolvedValueOnce({ deleted: true })
        .mockRejectedValueOnce(new Error('EPERM'))

      const controller = createBatchDeleteChapterCacheController()

      const req = {
        params: { sourceId: 'src-bleach' },
        body: { chapterIds: ['ch-1', 'ch-2'] },
        user: { sub: 'user-3' },
      } as unknown as FastifyRequest

      const reply = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn(),
      } as unknown as FastifyReply

      await controller(req, reply)

      expect(mockNotifications.notify).toHaveBeenCalledWith('user-3', {
        type: 'chapter_cache_deleted',
        title: '"Bleach" — capítulos apagados',
        message: '1 capítulo(s) apagado(s) do disco (1 falha(s))',
        metadata: {
          sourceId: 'src-bleach',
          successfulChapters: 1,
        },
      })
      expect(reply.send).toHaveBeenCalledWith({
        deletedCount: 1,
        totalCount: 2,
        alreadyCleanCount: 0,
        failedCount: 1,
      })
    })
  })

  describe('createDeleteChapterCacheController', () => {
    it('deve apagar capítulo único e emitir notificação no sininho', async () => {
      mockSourceRepo.load.mockResolvedValue({
        provider: { slug: 'mangalivre' },
        source: { url: 'https://mangalivre.net/manga/test' },
        metadata: { title: 'Boruto' },
        chapters: [{ id: 'ch-5', number: '5' }],
      })
      mockResolver.listAll.mockReturnValue([{ slug: 'mangalivre' }])
      mockChapterService.deleteCache.mockResolvedValueOnce({ deleted: true })

      const controller = createDeleteChapterCacheController()

      const req = {
        params: { sourceId: 'src-boruto', chapterId: 'ch-5' },
        user: { sub: 'user-1' },
      } as unknown as FastifyRequest

      const reply = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn(),
      } as unknown as FastifyReply

      await controller(req, reply)

      expect(mockChapterService.deleteCache).toHaveBeenCalledTimes(1)
      expect(mockNotifications.notify).toHaveBeenCalledWith('user-1', {
        type: 'chapter_cache_deleted',
        title: '"Boruto" — capítulo apagado',
        message: 'Capítulo 5 apagado do disco',
        metadata: {
          sourceId: 'src-boruto',
          successfulChapters: 1,
        },
      })
      expect(reply.code).toHaveBeenCalledWith(200)
      expect(reply.send).toHaveBeenCalledWith({ deleted: true })
    })
  })
})
