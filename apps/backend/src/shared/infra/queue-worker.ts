import { Worker } from 'bullmq'
import { env } from '../config/env'
import type { RuntimeAdapters } from './factory'
import { InMemoryQueueService } from './inmemory'

/**
 * Visão mínima de um job que o worker processa — desacoplada do BullMQ
 * (modo web) e do InMemoryQueueService (modo embedded).
 */
export interface QueueWorkerJob {
  id: string
  data: any
  attemptsMade: number
}

export interface StartQueueWorkerOptions {
  /** Runtime de infraestrutura (embedded ou web) do composition root. */
  runtime: RuntimeAdapters
  /** Nome da fila — uma instância compartilhada por nome via `runtime.getQueue`. */
  queueName: string
  /** Processa um único job. Qualquer throw dispara retry/falha do job. */
  processor: (job: QueueWorkerJob) => Promise<void>
  /** Concorrência do worker (padrão: 1). */
  concurrency?: number
  /**
   * Opcional: executado quando um job esgota as tentativas e falha de vez.
   * Útil para marcar o job como `failed` no repositório (mesma semântica do
   * `worker.on('failed')` do BullMQ).
   */
  onFailed?: (job: QueueWorkerJob, error: Error) => void | Promise<void>
}

export interface QueueWorkerHandle {
  /** Encerra o worker. No embedded, drena jobs pendentes/in-flight; no web, fecha o Worker BullMQ. */
  close(): Promise<void>
}

/**
 * Inicia um worker na fila `queueName` do runtime.
 *
 * - **embedded**: registra o processor na `InMemoryQueueService` compartilhada
 *   (mesma instância do produtor via `runtime.getQueue`). `lockDuration` e
 *   `maxStalledCount` (opções do BullMQ) são NO-OP aqui — a fila in-memory não
 *   trava jobs, então não há stall detection. `close()` encerra o loop.
 * - **web**: cria um `Worker` BullMQ com `connection.url = env.REDIS_URL` e a
 *   concorrência informada. `close()` fecha o worker.
 */
export function startQueueWorker(opts: StartQueueWorkerOptions): QueueWorkerHandle {
  const { runtime, queueName, processor, concurrency = 1, onFailed } = opts
  const queue = runtime.getQueue(queueName)

  if (queue instanceof InMemoryQueueService) {
    if (onFailed) {
      queue.onFailed = (job, error) => {
        const normalized: QueueWorkerJob = { id: job.id, data: job.data, attemptsMade: job.attemptsMade }
        void Promise.resolve(onFailed(normalized, toError(error)))
      }
    }
    void queue.process(
      (job) => processor({ id: job.id, data: job.data, attemptsMade: job.attemptsMade }),
      { concurrency },
    )
    return {
      close: () => queue.close(),
    }
  }

  const worker = new Worker(
    queueName,
    async (job) => {
      await processor({ id: String(job.id), data: job.data, attemptsMade: job.attemptsMade ?? 0 })
    },
    {
      connection: { url: env.REDIS_URL },
      concurrency,
    },
  )

  if (onFailed) {
    worker.on('failed', (job, error) => {
      const normalized: QueueWorkerJob = {
        id: String(job?.id ?? ''),
        data: job?.data,
        attemptsMade: job?.attemptsMade ?? 0,
      }
      void Promise.resolve(onFailed(normalized, toError(error)))
    })
  }

  return {
    close: () => worker.close(),
  }
}

function toError(err: unknown): Error {
  return err instanceof Error ? err : new Error(String(err))
}
