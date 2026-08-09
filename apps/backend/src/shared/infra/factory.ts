import { env } from '../config/env'
import type { IJournalStore, ILockService, IPubSub, IQueueService, IStatusStore } from './index'
import {
  InMemoryJournalStore,
  InMemoryLockService,
  InMemoryPubSub,
  InMemoryQueueService,
  InMemoryStatusStore,
} from './inmemory'
import {
  RedisJournalAdapter,
  RedisLockAdapter,
  RedisPubSubAdapter,
  RedisQueueAdapter,
  RedisStatusStoreAdapter,
} from './redis'

/** Adaptadores de runtime prontos para injeção — um de cada contrato. */
export interface RuntimeAdapters {
  /** Fila default (nome `'default'`) — mantido para compatibilidade. */
  queue: IQueueService
  pubsub: IPubSub
  journal: IJournalStore
  status: IStatusStore
  lock: ILockService
  /**
   * Resolve a fila por nome, compartilhando a MESMA instância entre produtor
   * e worker. No modo embedded devolve uma `InMemoryQueueService` por nome
   * (registry lazy); no modo web um `RedisQueueAdapter`.
   */
  getQueue(name: string): IQueueService
}

/** Opções de criação do runtime de infraestrutura. */
export interface RuntimeAdaptersOptions {
  /** Força modo embedded (in-memory). Padrão: `env.MI_EMBEDDED_MODE`. */
  embedded?: boolean
  /** URL Redis explícita (opcional). Padrão: `env.REDIS_URL`. */
  redisUrl?: string
}

/**
 * Cria o conjunto de adaptadores de runtime.
 *
 * - `embedded` (ou `env.MI_EMBEDDED_MODE`): instâncias in-memory — uma por contrato.
 * - senão: adaptadores Redis. NENHUMA conexão é aberta aqui: cada adapter
 *   conecta de forma lazy, apenas na primeira operação.
 *
 * Observação: no modo Redis, `queue` é um placeholder genérico (fila
 * `'default'`). No modo web, cada serviço de fila resolve o seu próprio
 * adapter via {@link createRedisQueueAdapter} com o nome da fila real.
 */
export function createRuntimeAdapters(options: RuntimeAdaptersOptions = {}): RuntimeAdapters {
  const embedded = options.embedded ?? env.MI_EMBEDDED_MODE

  if (embedded) {
    const queueRegistry = new Map<string, InMemoryQueueService>()
    return {
      queue: new InMemoryQueueService(),
      getQueue: (name: string) => {
        let queue = queueRegistry.get(name)
        if (!queue) {
          queue = new InMemoryQueueService()
          queueRegistry.set(name, queue)
        }
        return queue
      },
      pubsub: new InMemoryPubSub(),
      journal: new InMemoryJournalStore(),
      status: new InMemoryStatusStore(),
      lock: new InMemoryLockService(),
    }
  }

  return {
    queue: createRedisQueueAdapter('default'),
    getQueue: (name: string) => createRedisQueueAdapter(name),
    pubsub: new RedisPubSubAdapter({ redisUrl: options.redisUrl }),
    journal: new RedisJournalAdapter({ redisUrl: options.redisUrl }),
    status: new RedisStatusStoreAdapter({ redisUrl: options.redisUrl }),
    lock: new RedisLockAdapter(),
  }
}

/**
 * Cria um adapter de fila Redis (BullMQ) com o nome da fila real.
 * Usado pelos serviços de fila no modo web (uma fila por nome).
 */
export function createRedisQueueAdapter<T = unknown>(queueName: string): IQueueService<T> {
  return new RedisQueueAdapter<T>(queueName)
}
