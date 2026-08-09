import type { IQueueService, QueueJob } from '../../../shared/infra/queue.service'
import type { ConversionJobData } from '../types/conversion.types'

/**
 * Produtor de jobs de conversão download-only. A fila concreta
 * (`IQueueService`) é injetada no constructor pelo composition root.
 */
export class DownloadOnlyQueueService {
  constructor(private readonly queue: IQueueService<ConversionJobData>) {}

  async enqueue(data: ConversionJobData): Promise<QueueJob<ConversionJobData>> {
    return this.queue.add(`download-only:${data.jobId}`, data, {
      jobId: data.jobId,
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: { count: 50 },
      removeOnFail: { count: 25 },
    })
  }

  async remove(jobId: string): Promise<void> {
    await this.queue.removeJob(jobId)
  }

  async getJob(jobId: string): Promise<QueueJob<ConversionJobData> | null> {
    return this.queue.getJob(jobId)
  }
}
