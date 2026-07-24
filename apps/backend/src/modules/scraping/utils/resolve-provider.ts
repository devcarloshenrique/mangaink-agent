import { getSourceRepository } from '../../../shared/database/repositories'
import { ProviderResolver } from '../providers/provider-resolver'
import type { IProviderStrategy } from '../interfaces/provider-strategy.interface'

let _providerResolver: ProviderResolver | null = null

function getProviderResolver(): ProviderResolver {
  if (!_providerResolver) {
    _providerResolver = new ProviderResolver()
  }
  return _providerResolver
}

/**
 * Resolve o provider correto para o sourceId com rate limiter injetado.
 * Singleton de ProviderResolver para compartilhar instancias Bottleneck entre proxy e worker.
 */
export async function resolveProvider(sourceId: string): Promise<IProviderStrategy | null> {
  const source = await getSourceRepository().load(sourceId)
  if (!source) return null

  const firstChapter = source.chapters[0]
  if (!firstChapter?.url) return null

  const resolver = getProviderResolver()
  return resolver.resolve(firstChapter.url)
}
