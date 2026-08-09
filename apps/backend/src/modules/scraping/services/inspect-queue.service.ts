import type { IQueueService } from '../../../shared/infra/queue.service'
import type { SourceInspectJob } from '../types/source.types'

const QUEUE_NAME = 'source-inspect'

/**
 * Serviço responsável por enfileirar jobs de inspeção na fila.
 *
 * A fila concreta (`IQueueService<SourceInspectJob>`) é injetada no
 * constructor — o nome da fila fica resolvido no composition root.
 */
export class InspectQueueService {
  constructor(private readonly queue: IQueueService<SourceInspectJob>) {}

  /**
   * Adiciona um job de inspeção na fila.
   * O job ID é o próprio sourceId para evitar duplicidades.
   */
  async enqueue(job: SourceInspectJob): Promise<void> {
    await this.queue.add(QUEUE_NAME, job, {
      jobId: `${job.sourceId}-${Date.now()}`,
      removeOnComplete: true,
      removeOnFail: { count: 5 },
    })
  }

  /** Retorna o nome da fila para referência. */
  getQueueName(): string {
    return QUEUE_NAME
  }
}
