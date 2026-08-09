import type { Job, Queue } from 'bullmq'
import { createQueue } from '../../redis/bullmq'
import type {
  IQueueService,
  QueueAddOptions,
  QueueJob,
} from '../queue.service'

/**
 * Adaptador de {@link IQueueService} sobre o BullMQ (modo web).
 *
 * O nome da fila é fixado no constructor — cada instância representa UMA fila
 * real (`source-inspect`, `conversion-job`, etc.). A conexão BullMQ é criada
 * somente na primeira operação (lazy) para não abrir sockets no load.
 */
export class RedisQueueAdapter<T = unknown> implements IQueueService<T> {
  private queue?: Queue

  constructor(private readonly queueName: string) {}

  async add(name: string, data: T, opts?: QueueAddOptions): Promise<QueueJob<T>> {
    const job = await this.lazyQueue().add(name, data, opts as never)
    return this.mapJob<T>(job)
  }

  async getJob(jobId: string): Promise<QueueJob<T> | null> {
    const job = await this.lazyQueue().getJob(jobId)
    return job ? this.mapJob<T>(job) : null
  }

  async removeJob(jobId: string): Promise<void> {
    const job = await this.lazyQueue().getJob(jobId)
    if (job) await job.remove()
  }

  private lazyQueue(): Queue {
    if (!this.queue) {
      this.queue = createQueue(this.queueName)
    }
    return this.queue
  }

  private mapJob<T>(job: Job): QueueJob<T> {
    return {
      id: String(job.id),
      name: job.name,
      data: job.data as T,
      attemptsMade: job.attemptsMade ?? 0,
    }
  }
}
