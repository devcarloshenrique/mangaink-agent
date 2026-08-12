import type { ProviderRepository } from '../repositories/provider.repository'
import type { ProviderUpdate } from '../providers/known-providers.types'
import type { ProviderResolver } from '../providers/provider-resolver'
import type { ProviderRateLimitConfig } from '../rate-limit/rate-limit-registry'
import { ProviderBySlugNotFoundError } from '../errors/scraping.errors'
import {
  toProviderResponse,
  type ProviderResponse,
  type UpdateProviderBody,
} from '../dtos/provider.dto'
import { getProviderResolver } from '../utils/resolve-provider'

/** Achata o body parcial da API (com `rateLimit` aninhado) para o formato do repositório. */
function toUpdateData(input: UpdateProviderBody): ProviderUpdate {
  const { rateLimit, ...fields } = input
  const data: ProviderUpdate = { ...fields }
  if (rateLimit) {
    if (rateLimit.maxConcurrent !== undefined) data.rateLimitMaxConcurrent = rateLimit.maxConcurrent
    if (rateLimit.minTime !== undefined) data.rateLimitMinTime = rateLimit.minTime
    if (rateLimit.reservoir !== undefined) data.rateLimitReservoir = rateLimit.reservoir
    if (rateLimit.reservoirRefreshInterval !== undefined) {
      data.rateLimitReservoirRefreshInterval = rateLimit.reservoirRefreshInterval
    }
  }
  return data
}

function toRateLimitConfig(provider: {
  slug: string
  rateLimitMaxConcurrent: number
  rateLimitMinTime: number
  rateLimitReservoir: number | null
  rateLimitReservoirRefreshInterval: number | null
}): ProviderRateLimitConfig {
  return {
    slug: provider.slug,
    maxConcurrent: provider.rateLimitMaxConcurrent,
    minTime: provider.rateLimitMinTime,
    reservoir: provider.rateLimitReservoir ?? undefined,
    reservoirRefreshInterval: provider.rateLimitReservoirRefreshInterval ?? undefined,
  }
}

/**
 * Caso de uso: atualizar campos parciais de um provider (PATCH).
 *
 * Fluxo: valida (Zod, na rota) → salva no banco → atualiza o
 * `RateLimitRegistry` do singleton `ProviderResolver` → retorna o provider
 * atualizado. Slug inexistente → `ProviderBySlugNotFoundError` (404).
 */
export class UpdateProviderUseCase {
  constructor(
    private readonly repository: ProviderRepository,
    private readonly resolver: ProviderResolver = getProviderResolver(),
  ) {}

  async execute(slug: string, input: UpdateProviderBody): Promise<ProviderResponse> {
    const updated = await this.repository.update(slug, toUpdateData(input))
    if (!updated) throw new ProviderBySlugNotFoundError(slug)

    this.resolver.updateRateLimit(toRateLimitConfig(updated))

    return toProviderResponse(updated)
  }
}
