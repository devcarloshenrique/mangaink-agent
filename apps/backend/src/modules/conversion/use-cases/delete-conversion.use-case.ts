import type { ConversionRepository } from '../repositories/conversion.repository'
import {
  ConversionNotFoundError,
  ForbiddenError,
} from '../errors/conversion.errors'

export class DeleteConversionUseCase {
  constructor(private readonly conversions: ConversionRepository) {}

  async execute(
    conversionId: string,
    userId: string,
  ): Promise<{ conversionId: string; status: 'deleted' }> {
    const conversion = await this.conversions.findById(conversionId)
    if (!conversion) {
      throw new ConversionNotFoundError(conversionId)
    }

    if (conversion.config.userId !== userId) {
      throw new ForbiddenError(conversionId)
    }

    await this.conversions.delete(conversionId)

    return { conversionId, status: 'deleted' }
  }
}
