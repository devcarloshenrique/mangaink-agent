import { normalizeUrl } from '../../../shared/utils/url-normalizer'
import { createSourceId } from '../../../shared/utils/id-generator'
import { createRedisQueueAdapter } from '../../../shared/infra/factory'
import type { ILockService } from '../../../shared/infra'
import { getProviderResolver } from '../utils/resolve-provider'
import { getSourceRepository } from '../../../shared/database/repositories'
import { CacheService } from '../services/cache.service'
import { RedisLockService } from '../services/redis-lock.service'
import { InspectQueueService } from '../services/inspect-queue.service'
import { setInspectOwner } from '../services/inspect-owner-status-store'
import type { SourceInspectState } from '../types/source.types'
import { InvalidUrlError } from '../errors/scraping.errors'

const resolver = getProviderResolver()

let repository: ReturnType<typeof getSourceRepository> | undefined
let cacheService: CacheService | undefined
let queueService: InspectQueueService | undefined
let lockService: ILockService | undefined

function getRepository(): ReturnType<typeof getSourceRepository> {
  return (repository ??= getSourceRepository())
}

function getCacheService(): CacheService {
  return (cacheService ??= new CacheService(getRepository()))
}

function getQueueService(): InspectQueueService {
  return (queueService ??= new InspectQueueService(createRedisQueueAdapter('source-inspect')))
}

function getLockService(): ILockService {
  return (lockService ??= new RedisLockService())
}

/**
 * Injeta a fila de inspeção usada pelo use-case (chamada pelo composition root
 * com `runtime.getQueue('source-inspect')`). Sem chamada, o default é o adapter
 * Redis lazy — comportamento web preservado.
 */
export function setInspectQueueService(queue: InspectQueueService): void {
  queueService = queue
}

/**
 * Injeta o serviço de lock usado pelo use-case (chamada pelo composition root
 * com `runtime.lock`). Sem chamada, o default é o `RedisLockService` —
 * comportamento web preservado.
 */
export function setInspectLockService(lock: ILockService): void {
  lockService = lock
}

export interface InspectSourceInput {
  url: string
  refresh: boolean
  userId: string
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
      const isValid = await getCacheService().isValid(sourceId)
      if (isValid) {
        // Atualiza lastAccessAt e updatedAt
        await getCacheService().touch(sourceId)
        return { sourceId, status: 'ready' }
      }
    }

    // 5. Tenta adquirir lock (evita múltiplos scrapers para a mesma obra)
    const acquired = await getLockService().acquire(sourceId)

    if (acquired) {
      // 6. Enfileira job BullMQ
      await getQueueService().enqueue({
        sourceId,
        provider: provider.slug,
        url: canonicalUrl,
        refresh: input.refresh,
        userId: input.userId,
      })
      // Registra o dono da inspeção para escopar o canal SSE ao job do usuário
      await setInspectOwner(sourceId, input.userId)
    }
    // Se não adquiriu, outro worker já está processando — apenas retorna 'processing'

    return { sourceId, status: 'processing' }
  }
}
