import type { FastifyReply, FastifyRequest } from 'fastify'
import { env } from '../../../shared/config/env'
import { SourceNotFoundError, ProviderNotFoundError } from '../errors/scraping.errors'
import { getProviderResolver } from '../utils/resolve-provider'
import { ChapterImageService } from '../services/chapter-image.service'
import { PrismaSourceRepository } from '../repositories/prisma-source.repository'
import { getNotificationRepository } from '../../../shared/database/repositories'
import { createNotificationService } from '../../notification/services/notification.service'
import type { RuntimeAdapters } from '../../../shared/infra/factory'

const resolver = getProviderResolver()

export function createDeleteChapterCacheController(runtime?: RuntimeAdapters) {
  return async function deleteChapterCache(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const { sourceId, chapterId } = request.params as { sourceId: string; chapterId: string }
    const userId = (request.user as { sub: string } | undefined)?.sub

    const sourceRepo = new PrismaSourceRepository()
    const metadata = await sourceRepo.load(sourceId)
    if (!metadata) {
      throw new SourceNotFoundError(sourceId)
    }

    const provider = resolver.listAll().find((p) => p.slug === metadata.provider.slug)
    if (!provider) {
      throw new ProviderNotFoundError(metadata.source.url)
    }

    const service = new ChapterImageService(provider, sourceId, chapterId, env.STORAGE_PATH)
    const result = await service.deleteCache()

    if (userId && result.deleted) {
      try {
        const notifications = createNotificationService(getNotificationRepository(), runtime)
        const seriesTitle = metadata.metadata?.title || sourceId
        const chapter = metadata.chapters.find((c) => c.id === chapterId)
        const chapterLabel = chapter?.number ? `Capítulo ${chapter.number}` : `Capítulo ${chapterId}`

        await notifications.notify(userId, {
          type: 'chapter_cache_deleted',
          title: `"${seriesTitle}" — capítulo apagado`,
          message: `${chapterLabel} apagado do disco`,
          metadata: {
            sourceId,
            successfulChapters: 1,
          },
        })
      } catch {
        // best-effort
      }
    }

    return reply.code(200).send(result)
  }
}

export const deleteChapterCache = createDeleteChapterCacheController()
