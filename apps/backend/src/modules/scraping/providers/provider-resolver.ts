import type { IProviderStrategy } from '../interfaces/provider-strategy.interface'
import { MangaLivreStrategy } from './mangalivre/mangalivre.provider'
import { ProviderNotFoundError, InvalidUrlError } from '../errors/scraping.errors'
import { RateLimitRegistry } from '../rate-limit/rate-limit-registry'
import { createRateLimiter } from '../rate-limit/rate-limiter'

/** Registry de providers disponíveis. Para adicionar um novo, basta incluir aqui. */

/**
 * Descobre e retorna o provider correto para uma URL.
 * Valida o formato da URL e lança erro se não houver provider compatível.
 *
 * Injeta automaticamente um RateLimiter configurado para o provider.
 */
export class ProviderResolver {
  private readonly registry: RateLimitRegistry

  constructor(registry?: RateLimitRegistry) {
    this.registry = registry ?? new RateLimitRegistry()
    this.initProviders()
  }

  private providers: IProviderStrategy[] = []

  private initProviders(): void {
    const mangalivreConfig = this.registry.get('mangalivre')
    const mangalivreLimiter = createRateLimiter(mangalivreConfig)
    this.providers = [new MangaLivreStrategy(mangalivreLimiter)]
  }

  /**
   * Resolve o provider pela URL.
   * @throws {InvalidUrlError} se a URL for inválida
   * @throws {ProviderNotFoundError} se nenhum provider suportar a URL
   */
  resolve(url: string): IProviderStrategy {
    try {
      new URL(url)
    } catch {
      throw new InvalidUrlError(url)
    }

    const provider = this.providers.find((p) => p.supports(url))
    if (!provider) throw new ProviderNotFoundError(url)

    return provider
  }

  /** Lista todos os providers disponíveis. */
  listAll(): IProviderStrategy[] {
    return this.providers
  }
}
