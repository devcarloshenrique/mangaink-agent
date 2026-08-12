import { join, extname } from 'node:path'
import { writeFile } from 'node:fs/promises'
import { env } from '../../../shared/config/env'
import { mkdirp } from '../../../shared/utils/filesystem'
import { getProviderResolver } from '../utils/resolve-provider'

import { getSourceRepository } from '../../../shared/database/repositories'
import { CacheService } from '../services/cache.service'
import type { RuntimeAdapters } from '../../../shared/infra/factory'
import {
  startQueueWorker,
  type QueueWorkerHandle,
  type QueueWorkerJob,
} from '../../../shared/infra/queue-worker'
import type { ProgressMessage } from '../services/source-events.service'
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
      const { sourceId, url } = job.data as SourceInspectJob

      console.log(`[Worker] Iniciando scraping de ${sourceId}`)

      const publishProgress = (message: ProgressMessage) => {
        return pubsub.publish(`source:${sourceId}`, JSON.stringify(message))
      }

      try {
        await publishProgress({
          stage: 'metadata',
          progress: 10,
          message: 'Obtendo informações da obra',
        })

        const provider = resolver.resolve(url)
        const result = await provider.inspect(url)

        console.log(
          `[Worker] Scraping: ${result.chapters.length} chapters, ${result.covers.length} covers, ` +
            `title="${result.metadata.title}", sourceId=${sourceId}`,
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
            await writeFile(coverPath, buffer)
            console.log(`[Worker] Capa baixada: ${coverPath}`)
          } catch (err) {
            console.warn(
              `[Worker] Falha ao baixar capa de ${sourceId}:`,
              err instanceof Error ? err.message : 'unknown',
            )
          }
        }

        console.log(`[Worker] Scraping concluído: ${sourceId}`)

        await publishProgress({
          stage: 'completed',
          progress: 100,
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro desconhecido'
        console.error(`[Worker] Falha no scraping de ${sourceId}:`, message)

        await publishProgress({
          stage: 'failed',
          message,
        })

        throw err
      } finally {
        try {
          await lockService.release(sourceId)
        } catch (err) {
          console.warn(
            `[Worker] Falha ao liberar lock de ${sourceId}:`,
            err instanceof Error ? err.message : 'unknown',
          )
        }
      }
    },
  })
}
