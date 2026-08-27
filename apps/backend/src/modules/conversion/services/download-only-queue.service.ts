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
      // SEM auto-retry: falha desses jobs é determinística (site 404, provider,
      // imagens) e o retry é MANUAL (botão "Tentar novamente"). Auto-retry
      // re-executava o job antigo depois do clique, ressuscitava o status da
      // conversão para `processing` e multiplicava notificações de falha.
      attempts: 1,
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
