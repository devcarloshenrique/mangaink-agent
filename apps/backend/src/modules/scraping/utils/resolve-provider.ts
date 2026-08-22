import { getSourceRepository } from '../../../shared/database/repositories'
import { ProviderResolver } from '../providers/provider-resolver'
import type { IProviderStrategy } from '../interfaces/provider-strategy.interface'

let _providerResolver: ProviderResolver | null = null

/**
 * Singleton oficial de `ProviderResolver` (MEC-31 S4).
 * Compartilha as instâncias Bottleneck entre proxy, worker e controllers.
 */
export function getProviderResolver(): ProviderResolver {
  if (!_providerResolver) {
    _providerResolver = new ProviderResolver()
  }
  return _providerResolver
}

/**
 * Recarrega o singleton a partir do estado atual do registry (ex.: após
 * `loadFromProviders` do banco). Reconstrói as strategies com as novas configs,
 * preservando as instâncias Bottleneck compartilhadas.
 */
export function refreshProviderResolver(): void {
  const resolver = getProviderResolver()
  resolver.refresh()
}

/** Reseta o singleton (uso em testes). */
export function resetProviderResolver(): void {
  _providerResolver = null
}

/**
 * Resolve o provider correto para o sourceId com rate limiter injetado.
 */
export async function resolveProvider(sourceId: string): Promise<IProviderStrategy | null> {
  const source = await getSourceRepository().load(sourceId)
  if (!source) return null

  const resolver = getProviderResolver()

  const chapterWithUrl = source.chapters?.find((c) => !!c.url)
  if (chapterWithUrl?.url) {
    try {
      return resolver.resolve(chapterWithUrl.url)
    } catch {
      // continua para os fallbacks
    }
  }

  if (source.source?.url) {
    try {
      return resolver.resolve(source.source.url)
    } catch {
      // continua para os fallbacks
    }
  }

  if (source.provider?.slug) {
    const matching = resolver.listAll().find((p) => p.slug === source.provider.slug)
    if (matching) return matching
  }

  return null
}
