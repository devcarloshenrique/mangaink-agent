import { JobLiveStatusStore } from '../../../shared/redis/job-status-store'
import { getConversionJobRepository } from '../../../shared/database/repositories'
import type { ConversionRepository } from '../repositories/conversion.repository'
import type { ConversionQueueService } from '../services/conversion-queue.service'
import type { DownloadOnlyQueueService } from '../services/download-only-queue.service'
import type { ConversionEventsService } from '../services/conversion-events.service'
import {
  ConversionNotFoundError,
  InvalidConversionStateError,
  ForbiddenError,
} from '../errors/conversion.errors'

/**
 * Cancela uma Conversion inteira: remove da fila BullMQ cada Job ainda
 * pendente e marca como `cancelled` os Jobs em andamento.
 */
export class CancelConversionUseCase {
  constructor(
    private readonly conversions: ConversionRepository,
    private readonly queue: ConversionQueueService,
    private readonly events: ConversionEventsService,
    private readonly downloadOnlyQueue?: DownloadOnlyQueueService,
  ) {}

  async execute(
    conversionId: string,
    userId: string,
  ): Promise<{ conversionId: string; status: 'cancelled' }> {
    const found = await this.conversions.findById(conversionId)
    if (!found) {
      throw new ConversionNotFoundError(conversionId)
    }

    if (found.config.userId !== userId) {
      throw new ForbiddenError(conversionId)
    }

    const terminal = ['completed', 'failed', 'cancelled']
    if (terminal.includes(found.status)) {
      throw new InvalidConversionStateError(
        conversionId,
        found.status,
        'queued | processing | partial',
      )
    }

    const jobIds = await this.conversions.listJobIds(conversionId)

    const jobRepo = getConversionJobRepository()
    const store = new JobLiveStatusStore()
    const now = new Date().toISOString()

    for (const jobId of jobIds) {
      const job = await jobRepo.findById(jobId)
      if (!job) continue

      const isInQueue = job.status === 'queued'
      const isActive = ['preparing', 'downloading', 'converting', 'packaging'].includes(job.status)

      if (isInQueue) {
        try {
          await this.queue.remove(jobId)
        } catch {
          // melhor-esforço
        }
        if (this.downloadOnlyQueue) {
          try {
            await this.downloadOnlyQueue.remove(jobId)
          } catch {
            // melhor-esforço
          }
        }
        await store
          .set(jobId, {
            status: 'cancelled',
            updatedAt: now,
          })
          .catch(() => {})
        await jobRepo.update(jobId, {
          status: 'cancelled',
          currentStep: 'Cancelled',
        })
      }

      if (isActive) {
        // Redis-first: worker detecta em próximo capítulo e faz persist terminal
        await store
          .set(jobId, {
            status: 'cancelled',
            updatedAt: now,
          })
          .catch(() => {})
      }
    }

    // Recomputa o agregado a partir dos jobs já cancelados.
    await this.conversions.syncStatus(conversionId)

    await this.events.emit(
      conversionId,
      this.events.createEvent('conversion.cancelled', {
        conversionId,
        status: 'cancelled',
      }),
    )

    return { conversionId, status: 'cancelled' }
  }
}
