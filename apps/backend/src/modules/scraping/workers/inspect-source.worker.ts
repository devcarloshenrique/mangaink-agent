import { Worker } from 'bullmq'
import { join, extname } from 'node:path'
import { writeFile } from 'node:fs/promises'
import { env } from '../../../shared/config/env'
import { mkdirp } from '../../../shared/utils/filesystem'
import { ProviderResolver } from '../providers/provider-resolver'
import { RateLimitRegistry } from '../rate-limit/rate-limit-registry'
import { getSourceRepository } from '../../../shared/database/repositories'
import { CacheService } from '../services/cache.service'
import { RedisLockService } from '../services/redis-lock.service'
import { RedisPubSubService } from '../services/redis-pubsub.service'
import type { SourceInspectJob } from '../types/source.types'
import type { SourceMetadataFile } from '../types/metadata.types'

const QUEUE_NAME = 'source-inspect'

const registry = new RateLimitRegistry()
const resolver = new ProviderResolver(registry)
const repository = getSourceRepository()
const cacheService = new CacheService(repository)
const lockService = new RedisLockService()
const pubsub = new RedisPubSubService()

/**
 * Worker BullMQ responsável por executar o scraping em background.
 */
export const inspectSourceWorker = new Worker<SourceInspectJob>(
  QUEUE_NAME,
  async (job) => {
    const { sourceId, url } = job.data

    console.log(`[Worker] Iniciando scraping de ${sourceId}`)

    try {
      await pubsub.publish(sourceId, {
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

      await pubsub.publish(sourceId, {
        stage: 'chapters',
        progress: 60,
        message: 'Obtendo capítulos',
      })

      await pubsub.publish(sourceId, {
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

      await pubsub.publish(sourceId, {
        stage: 'completed',
        progress: 100,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido'
      console.error(`[Worker] Falha no scraping de ${sourceId}:`, message)

      await pubsub.publish(sourceId, {
        stage: 'failed',
        message,
      })

      throw err
    } finally {
      await lockService.release(sourceId)
    }
  },
  {
    connection: {
      url: env.REDIS_URL,
    },
    concurrency: 3,
  },
)

inspectSourceWorker.on('completed', (job) => {
  console.log(`[Worker] Job ${job.id} concluído`)
})

inspectSourceWorker.on('failed', (job, err) => {
  console.error(`[Worker] Job ${job?.id} falhou:`, err.message)
})
