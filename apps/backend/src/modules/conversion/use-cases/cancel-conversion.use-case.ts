import { join } from 'node:path'
import { readJson, pathExists } from '../../../shared/utils/filesystem'
import { env } from '../../../shared/config/env'
import type { ConversionRepository } from '../repositories/conversion.repository'
import type { ConversionQueueService } from '../services/conversion-queue.service'
import type { ConversionEventsService } from '../services/conversion-events.service'
import type { ConversionState } from '../types/conversion.types'
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
  ) {}

  async execute(conversionId: string, userId: string): Promise<{ conversionId: string; status: 'cancelled' }> {
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
    const pathJoin = join

    for (const jobId of jobIds) {
      const statusPath = pathJoin(
        env.CONVERSIONS_STORAGE_PATH,
        conversionId,
        'jobs',
        jobId,
        'status.json',
      )
      if (!(await pathExists(statusPath))) continue
      const jobStatus = await readJson<{ status: string }>(statusPath)
      const isInQueue = jobStatus?.status === 'queued'
      const isActive = ['preparing', 'downloading', 'converting', 'packaging'].includes(
        jobStatus?.status ?? '',
      )

      if (isInQueue) {
        try {
          await this.queue.remove(jobId)
        } catch {
          // melhor-esforço
        }
      }

      if (isInQueue || isActive) {
        // Atualiza status.json do job diretamente.
        const { writeJson } = await import('../../../shared/utils/filesystem')
        const existing = await readJson<Record<string, unknown>>(statusPath)
        if (existing) {
          await writeJson(statusPath, {
            ...existing,
            status: 'cancelled',
            currentStep: 'Cancelled',
            updatedAt: new Date().toISOString(),
          })
        }
      }
    }

    // Recomputa o agregado a partir dos jobs já cancelados.
    await this.conversions.syncStatus(conversionId)

    await this.events.emit(conversionId, this.events.createEvent('conversion.cancelled', {
      conversionId,
      status: 'cancelled',
    }))

    return { conversionId, status: 'cancelled' }
  }
}

// mantido para evitar warning de import unused em alguns ambientes
export type { ConversionState }