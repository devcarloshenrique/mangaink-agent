import { Worker } from 'bullmq'
import { env } from '../../../shared/config/env'
import { ProviderResolver } from '../providers/provider-resolver'
import { FilesystemSourceRepository } from '../repositories/filesystem-source.repository'
import { CacheService } from '../services/cache.service'
import { RedisLockService } from '../services/redis-lock.service'
import { RedisPubSubService } from '../services/redis-pubsub.service'
import type { SourceInspectJob } from '../types/source.types'
import type { SourceMetadataFile } from '../types/metadata.types'

const QUEUE_NAME = 'source-inspect'

const resolver = new ProviderResolver()
const repository = new FilesystemSourceRepository()
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
