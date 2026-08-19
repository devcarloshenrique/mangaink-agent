import { join, extname } from 'node:path'
import { writeFile } from 'node:fs/promises'
import { env } from '../../../shared/config/env'
import { mkdirp } from '../../../shared/utils/filesystem'
import { assertValidImage } from '../../../shared/utils/image-validation'
import { getProviderResolver } from '../utils/resolve-provider'
import { logger } from '../../../shared/logging/logger'

import { getSourceRepository } from '../../../shared/database/repositories'
import { CacheService } from '../services/cache.service'
import type { RuntimeAdapters } from '../../../shared/infra/factory'
import {
  startQueueWorker,
  type QueueWorkerHandle,
  type QueueWorkerJob,
} from '../../../shared/infra/queue-worker'
import type { ProgressMessage } from '../services/source-events.service'
import { clearInspectOwner } from '../services/inspect-owner-status-store'
import type { SourceInspectJob } from '../types/source.types'
import type { SourceMetadataFile } from '../types/metadata.types'

const QUEUE_NAME = 'source-inspect'

/**
 * Worker responsável por executar o scraping em background.
 *
 * Factory: NENHUMA instância de serviço é criada no load do módulo — todas as
 * dependências (registry, resolver, repo, cache, lock e pubsub) são construídas
 * a partir do runtime injetado e vivem dentro da factory.
 */
export function startInspectSourceWorker(deps: { runtime: RuntimeAdapters }): QueueWorkerHandle {
  const { runtime } = deps

  const resolver = getProviderResolver()
  const repository = getSourceRepository()
  const cacheService = new CacheService(repository)
  const lockService = runtime.lock
  const pubsub = runtime.pubsub

  return startQueueWorker({
    runtime,
    queueName: QUEUE_NAME,
    concurrency: 3,
    processor: async (job: QueueWorkerJob) => {
      const { sourceId, url, userId } = job.data as SourceInspectJob

      logger.info({ sourceId, url, userId }, '[Worker] Iniciando scraping')

      // Canal escopado ao usuário dono do job — impede que outro usuário observe
      // o progresso via SSE.
      const channel = `source:${userId}:${sourceId}`

      const publishProgress = (message: ProgressMessage) => {
        return pubsub.publish(channel, JSON.stringify(message))
      }

      try {
        await publishProgress({
          stage: 'metadata',
          progress: 10,
          message: 'Obtendo informações da obra',
        })

        const provider = resolver.resolve(url)
        const result = await provider.inspect(url)

        logger.info(
          { sourceId, chaptersCount: result.chapters.length, coversCount: result.covers.length, title: result.metadata.title },
          '[Worker] Inspecao concluida',
        )

        await publishProgress({
          stage: 'chapters',
          progress: 60,
          message: 'Obtendo capítulos',
        })

        await publishProgress({
          stage: 'covers',
          progress: 80,
          message: 'Obtendo capas',
        })

        const cache = cacheService.createFreshCache()
        const metadataFile: SourceMetadataFile = {
          ...result,
          cache,
        }

        await repository.save(sourceId, metadataFile)

        // ── Download da capa original para cache em disco ─────────────
        const originalCover = result.covers.find((c) => c.type === 'original') ?? result.covers[0]
        if (originalCover?.imageUrl) {
          try {
            const urlExt = extname(new URL(originalCover.imageUrl).pathname).toLowerCase() || '.jpg'
            const coversDir = join(env.STORAGE_PATH, 'sources', sourceId, 'covers')
            const coverPath = join(coversDir, `${originalCover.id}${urlExt}`)
            await mkdirp(coversDir)
            const { buffer } = await provider.downloadImage(originalCover.imageUrl)
            assertValidImage(buffer)
            await writeFile(coverPath, buffer)
            logger.debug({ sourceId, coverPath }, '[Worker] Capa original baixada para cache')
          } catch (err) {
            logger.warn(
              { sourceId, err: err instanceof Error ? err.message : String(err) },
              '[Worker] Falha ao baixar capa — nao critico, continuando',
            )
          }
        }

        logger.info({ sourceId }, '[Worker] Scraping concluido com sucesso')

        await publishProgress({
          stage: 'completed',
          progress: 100,
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro desconhecido'
        logger.error(
          { sourceId, url, err: err instanceof Error ? { message: err.message, stack: err.stack } : String(err) },
          '[Worker] Falha no scraping',
        )

        await publishProgress({
          stage: 'failed',
          message,
        })

        throw err
      } finally {
        try {
          await lockService.release(sourceId)
        } catch (err) {
          logger.warn(
            { sourceId, err: err instanceof Error ? err.message : String(err) },
            '[Worker] Falha ao liberar lock',
          )
        }
        try {
          await clearInspectOwner(sourceId)
        } catch (err) {
          logger.warn(
            { sourceId, err: err instanceof Error ? err.message : String(err) },
            '[Worker] Falha ao limpar dono de inspecao',
          )
        }
      }
    },
  })
}
