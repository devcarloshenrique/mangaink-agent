import { getSourceRepository } from '../../../shared/database/repositories'
import type { SourceInspectResponse } from '../types/source.types'
import { SourceNotFoundError } from '../errors/scraping.errors'

const repository = getSourceRepository()

/**
 * Caso de uso: buscar os dados completos de uma source já inspecionada.
 * Remove o campo `cache` antes de retornar (nunca exposto pela API).
 */
export class GetSourceUseCase {
  async execute(sourceId: string): Promise<SourceInspectResponse> {
    const metadata = await repository.load(sourceId)

    if (!metadata) {
      throw new SourceNotFoundError(sourceId)
    }

    // Remove o campo interno `cache` da resposta
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { cache: _cache, ...response } = metadata

    return response as SourceInspectResponse
  }
}
