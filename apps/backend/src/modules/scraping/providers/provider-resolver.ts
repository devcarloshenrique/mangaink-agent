import type { IProviderStrategy } from '../interfaces/provider-strategy.interface'
import { MangaLivreStrategy } from './mangalivre/mangalivre.provider'
import { ImperioDaBritanniaStrategy } from './imperiodabritannia/imperiodabritannia.provider'
import { MangaDexStrategy } from './mangadex/mangadex.provider'
import { TaiyoStrategy } from './taiyo/taiyo.provider'
import { MangapillStrategy } from './mangapill/mangapill.provider'
import { MangaReadStrategy } from './mangaread/mangaread.provider'
import { FlameComicsStrategy } from './flamecomics/flamecomics.provider'
import { AsuraScansStrategy } from './asurascans/asurascans.provider'
import { MangaKakalotStrategy } from './mangakakalot/mangakakalot.provider'
import { MangaFireStrategy } from './mangafire/mangafire.provider'
import { ProviderNotFoundError, InvalidUrlError } from '../errors/scraping.errors'
import { RateLimitRegistry, type ProviderRateLimitConfig } from '../rate-limit/rate-limit-registry'
import { createRateLimiter } from '../rate-limit/rate-limiter'
import type { RateLimiter, RateLimiterConfig } from '../rate-limit/types'

type StrategyFactory = (limiter: RateLimiter) => IProviderStrategy

/** Registry de providers disponíveis. Para adicionar um novo, basta incluir aqui. */
const PROVIDER_FACTORIES: ReadonlyArray<{ slug: string; create: StrategyFactory }> = [
  { slug: 'mangalivre', create: (limiter) => new MangaLivreStrategy(limiter) },
  { slug: 'imperiodabritannia', create: (limiter) => new ImperioDaBritanniaStrategy(limiter) },
  { slug: 'mangadex', create: (limiter) => new MangaDexStrategy(limiter) },
  { slug: 'taiyo', create: (limiter) => new TaiyoStrategy(limiter) },
  { slug: 'mangapill', create: (limiter) => new MangapillStrategy(limiter) },
  { slug: 'mangaread', create: (limiter) => new MangaReadStrategy(limiter) },
  { slug: 'flamecomics', create: (limiter) => new FlameComicsStrategy(limiter) },
  { slug: 'asurascans', create: (limiter) => new AsuraScansStrategy(limiter) },
  { slug: 'mangakakalot', create: (limiter) => new MangaKakalotStrategy(limiter) },
  { slug: 'mangafire', create: (limiter) => new MangaFireStrategy(limiter) },
]

/**
 * Descobre e retorna o provider correto para uma URL.
 * Valida o formato da URL e lança erro se não houver provider compatível.
 *
 * Injeta automaticamente um RateLimiter configurado para o provider.
 * Deve ser usado via o singleton `getProviderResolver()` (utils/resolve-provider.ts)
 * para compartilhar as instâncias Bottleneck entre proxy, worker e controllers.
 */
export class ProviderResolver {
  private readonly registry: RateLimitRegistry
  private readonly limiters = new Map<string, { config: RateLimiterConfig; limiter: RateLimiter }>()
  private providers: IProviderStrategy[] = []

  constructor(registry?: RateLimitRegistry) {
    this.registry = registry ?? new RateLimitRegistry()
    this.refresh()
  }

  /**
   * Alimenta o registry com as configs dos providers persistidos no banco
   * (chamado pelo `initProviders()` do boot). Reconstrói providers/limiters.
   */
  loadFromProviders(configs: ProviderRateLimitConfig[]): void {
    this.registry.loadFromProviders(configs)
    this.refresh()
  }

  /**
   * Atualiza a config de rate limit de um único provider no registry e
   * reconstrói as strategies com o novo limiter (MEC-38 PATCH de providers).
   * Providers cuja config não mudou mantêm as instâncias Bottleneck.
   */
  updateRateLimit(config: ProviderRateLimitConfig): void {
    this.registry.set(config)
    this.refresh()
  }

  /**
   * Reconstrói as strategies dos providers com as configs atuais do registry,
   * preservando as instâncias Bottleneck compartilhadas quando a config não mudou.
   */
  refresh(): void {
    this.providers = PROVIDER_FACTORIES.map(({ slug, create }) =>
      create(this.getOrCreateLimiter(slug, this.registry.get(slug))),
    )
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

  /** Retorna um provider pelo seu slug. */
  getBySlug(slug: string): IProviderStrategy | undefined {
    return this.providers.find((p) => p.slug === slug)
  }

  private getOrCreateLimiter(slug: string, config: RateLimiterConfig): RateLimiter {
    const existing = this.limiters.get(slug)
    if (existing && this.isSameConfig(existing.config, config)) {
      return existing.limiter
    }

    const limiter = createRateLimiter(config)
    this.limiters.set(slug, { config, limiter })
    return limiter
  }

  private isSameConfig(current: RateLimiterConfig, next: RateLimiterConfig): boolean {
    return (
      current.maxConcurrent === next.maxConcurrent &&
      current.minTime === next.minTime &&
      current.reservoir === next.reservoir &&
      current.reservoirRefreshInterval === next.reservoirRefreshInterval
    )
  }
}
