import type { GetConversionUseCase } from './get-conversion.use-case'
import type { ConversionPubSubService } from '../services/conversion-pubsub.service'
import type { SSEEvent } from '../types/conversion.types'
import { ConversionNotFoundError, ForbiddenError } from '../errors/conversion.errors'

const JOURNAL_PREFIX = 'conversion-journal:'

export class GetConversionLogsUseCase {
  constructor(
    private readonly getConversion: GetConversionUseCase,
    private readonly pubsub: ConversionPubSubService,
  ) {}

  async execute(conversionId: string, userId: string): Promise<SSEEvent[]> {
    const state = await this.getConversion.execute(conversionId, userId)

    if (!state) {
      throw new ConversionNotFoundError(conversionId)
    }
    if (state.config.userId !== userId) {
      throw new ForbiddenError(conversionId)
    }

    const allEntries: SSEEvent[] = []

    for (const job of state.jobs) {
      const journalKey = `${JOURNAL_PREFIX}${job.jobId}`
      const rawEntries = await this.pubsub.pubLrange(journalKey, 0, -1)

      for (const raw of rawEntries) {
        try {
          const event = JSON.parse(raw) as SSEEvent
          allEntries.push(event)
        } catch {
          // entrada inválida no journal
        }
      }
    }

    return allEntries
  }
}
