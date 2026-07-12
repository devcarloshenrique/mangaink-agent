import type { ConversionRepository } from '../repositories/conversion.repository'
import type { ConversionState } from '../types/conversion.types'
import { ConversionNotFoundError, ForbiddenError } from '../errors/conversion.errors'

/**
 * Recomputa o status agregado da Conversion em tempo real
 * (delega ao repositório que lê todos os status.json dos Jobs).
 */
export class GetConversionUseCase {
  constructor(private readonly conversions: ConversionRepository) {}

  async execute(conversionId: string, userId: string): Promise<ConversionState> {
    const state = await this.conversions.syncStatus(conversionId)
    if (!state) {
      throw new ConversionNotFoundError(conversionId)
    }
    if (state.config.userId !== userId) {
      throw new ForbiddenError(conversionId)
    }
    return state
  }
}