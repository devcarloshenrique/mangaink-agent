import { normalizeUrl } from '../../../shared/utils/url-normalizer'
import { createSourceId } from '../../../shared/utils/id-generator'
import { ProviderResolver } from '../providers/provider-resolver'
import { FilesystemSourceRepository } from '../repositories/filesystem-source.repository'
import { CacheService } from '../services/cache.service'
import { RedisLockService } from '../services/redis-lock.service'
import { InspectQueueService } from '../services/inspect-queue.service'
import type { SourceInspectState } from '../types/source.types'
import { InvalidUrlError } from '../errors/scraping.errors'

const resolver = new ProviderResolver()
const repository = new FilesystemSourceRepository()
const cacheService = new CacheService(repository)
const lockService = new RedisLockService()
const queueService = new InspectQueueService()

export interface InspectSourceInput {
  url: string
  refresh: boolean
}

/**
 * Caso de uso: iniciar inspeção de uma source.
 *
 * Fluxo:
 * 1. Valida e normaliza a URL
 * 2. Resolve o provider pela URL (SSRF protection — apenas providers cadastrados)
 * 3. Gera sourceId determinístico
 * 4. Verifica cache (se válido e não refresh, retorna 'ready')
 * 5. Tenta adquirir lock Redis
 * 6. Se adquiriu, enfileira job BullMQ
 * 7. Retorna 'processing'
 */
export class InspectSourceUseCase {
  async execute(input: InspectSourceInput): Promise<SourceInspectState> {
    // 1. Normaliza URL (remove tracking params, garante trailing slash)
    let canonicalUrl: string
    try {
      canonicalUrl = normalizeUrl(input.url)
    } catch {
      throw new InvalidUrlError(input.url)
    }

    // 2. Resolve provider (valida domínio contra SSRF)
    const provider = resolver.resolve(canonicalUrl)

    // 3. Gera sourceId determinístico
    const sourceId = createSourceId(provider.slug, canonicalUrl)

    // 4. Cache válido e não é refresh?
    if (!input.refresh) {
      const isValid = await cacheService.isValid(sourceId)
      if (isValid) {
        // Atualiza lastAccessAt e updatedAt
        await cacheService.touch(sourceId)
        return { sourceId, status: 'ready' }
      }
    }

    // 5. Tenta adquirir lock (evita múltiplos scrapers para a mesma obra)
    const acquired = await lockService.acquire(sourceId)

    if (acquired) {
      // 6. Enfileira job BullMQ
      await queueService.enqueue({
        sourceId,
        provider: provider.slug,
        url: canonicalUrl,
        refresh: input.refresh,
      })
    }
    // Se não adquiriu, outro worker já está processando — apenas retorna 'processing'

    return { sourceId, status: 'processing' }
  }
}
