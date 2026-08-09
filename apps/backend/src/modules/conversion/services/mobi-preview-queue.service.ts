import type { IQueueService, QueueJob } from '../../../shared/infra/queue.service'
import type { MobiPreviewJobData, MobiPreviewQueue } from '../use-cases/mobi-preview.use-case'

/**
 * Fila para extracao assincrona de preview MOBI.
 *
 * Segue o padrao do `ConversionQueueService` — adiciona jobs com `jobId` como
 * chave determinista (evita duplicacao). A fila concreta (`IQueueService`)
 * é injetada no constructor pelo composition root.
 */
export class MobiPreviewQueueService implements MobiPreviewQueue {
  constructor(private readonly queue: IQueueService<MobiPreviewJobData>) {}

  async enqueue(data: MobiPreviewJobData): Promise<QueueJob<MobiPreviewJobData>> {
    return this.queue.add(`mobi-preview:${data.jobId}`, data, {
      jobId: data.jobId,
      attempts: 2,
      backoff: { type: 'exponential', delay: 3000 },
      removeOnComplete: { count: 50 },
      removeOnFail: { count: 25 },
    })
  }
}
