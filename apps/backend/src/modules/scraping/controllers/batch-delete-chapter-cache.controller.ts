import type { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { env } from '../../../shared/config/env'
import { SourceNotFoundError, ProviderNotFoundError } from '../errors/scraping.errors'
import { getProviderResolver } from '../utils/resolve-provider'
import { ChapterImageService } from '../services/chapter-image.service'
import { PrismaSourceRepository } from '../repositories/prisma-source.repository'
import { getNotificationRepository } from '../../../shared/database/repositories'
import { createNotificationService } from '../../notification/services/notification.service'
import type { RuntimeAdapters } from '../../../shared/infra/factory'

export const batchDeleteChapterCacheBodySchema = z.object({
  chapterIds: z.array(z.string()).min(1, 'Informe pelo menos um capítulo para exclusão'),
})

export type BatchDeleteChapterCacheBody = z.infer<typeof batchDeleteChapterCacheBodySchema>

const resolver = getProviderResolver()

export function createBatchDeleteChapterCacheController(runtime?: RuntimeAdapters) {
  return async function batchDeleteChapterCache(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const { sourceId } = request.params as { sourceId: string }
    const { chapterIds } = request.body as BatchDeleteChapterCacheBody
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

    let deletedCount = 0
    let failedCount = 0
    let alreadyCleanCount = 0

    for (const chapterId of chapterIds) {
      try {
        const service = new ChapterImageService(provider, sourceId, chapterId, env.STORAGE_PATH)
        const result = await service.deleteCache()
        if (result.deleted) {
          deletedCount++
        } else {
          alreadyCleanCount++
        }
      } catch {
        failedCount++
      }
    }

    if (userId && (deletedCount > 0 || failedCount > 0)) {
      try {
        const notifications = createNotificationService(getNotificationRepository(), runtime)
        const seriesTitle = metadata.metadata?.title || sourceId
        const hasFailures = failedCount > 0

        await notifications.notify(userId, {
          type: 'chapter_cache_deleted',
          title: `"${seriesTitle}" — capítulos apagados`,
          message: hasFailures
            ? `${deletedCount} capítulo(s) apagado(s) do disco (${failedCount} falha(s))`
            : `${deletedCount} capítulo(s) apagado(s) do disco`,
          metadata: {
            sourceId,
            successfulChapters: deletedCount,
          },
        })
      } catch {
        // best-effort: notificação nunca deve quebrar a resposta da exclusão
      }
    }

    return reply.code(200).send({
      deletedCount,
      totalCount: chapterIds.length,
      alreadyCleanCount,
      failedCount,
    })
  }
}

export const batchDeleteChapterCache = createBatchDeleteChapterCacheController()
