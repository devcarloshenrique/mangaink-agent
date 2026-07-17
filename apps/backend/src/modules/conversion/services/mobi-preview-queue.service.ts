import { createQueue } from '../../../shared/redis/bullmq'
import type { Job } from 'bullmq'
import type { MobiPreviewJobData, MobiPreviewQueue } from '../use-cases/mobi-preview.use-case'

/**
 * Fila BullMQ para extracao assincrona de preview MOBI.
 *
 * Reutiliza o factory `createQueue` (mesma conexao Redis) e segue o padrao
 * do `ConversionQueueService` — adiciona jobs com `jobId` como chave
 * determinista (evita duplicacao).
 */
export class MobiPreviewQueueService implements MobiPreviewQueue {
  private readonly queue = createQueue<MobiPreviewJobData>('mobi-preview')

  async enqueue(data: MobiPreviewJobData): Promise<Job<MobiPreviewJobData>> {
    return this.queue.add(`mobi-preview:${data.jobId}`, data, {
      jobId: data.jobId,
      attempts: 2,
      backoff: { type: 'exponential', delay: 3000 },
      removeOnComplete: { count: 50 },
      removeOnFail: { count: 25 },
    })
  }

  async close(): Promise<void> {
    await this.queue.close()
  }
}