import type { ConversionRepository } from '../repositories/conversion.repository'
import {
  ConversionNotFoundError,
  ForbiddenError,
} from '../errors/conversion.errors'
import type { ConversionStorageService } from '../services/conversion-storage.service'
import { logger } from '../../../shared/logging/logger'

export class DeleteConversionUseCase {
  constructor(
    private readonly conversions: ConversionRepository,
    private readonly storage: ConversionStorageService,
  ) {}

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

    // 1º remove a linha do banco (fonte de verdade) — nunca apaga o storage de
    // uma conversão que ainda existe no banco.
    await this.conversions.delete(conversionId)

    // 2º remove recursivamente o storage (outputs + logs + previews temporários).
    // Fallback: se a remoção falhar, o serviço registra o log e retorna `false` —
    // a resposta não quebra e o sweeper periódico recolhe o diretório órfão depois.
    const removed = await this.storage.removeConversion(conversionId)
    if (!removed) {
      logger.error(
        { conversionId },
        '[DeleteConversion] Storage não removido — o sweeper de storage órfão vai recolhê-lo na próxima varredura',
      )
    }

    return { conversionId, status: 'deleted' }
  }
}
