import type { ScrapingProvider } from '../../providers/provider.interface'
import { ProviderNotFoundError } from '../../errors/scraping.errors'

export class MockProviderResolver {
  private _providers: ScrapingProvider[] = []
  private _resolveError: Error | null = null

  setProviders(providers: ScrapingProvider[]): void {
    this._providers = providers
  }

  setResolveError(error: Error): void {
    this._resolveError = error
  }

  resolve(url: string): ScrapingProvider {
    if (this._resolveError) throw this._resolveError

    const provider = this._providers.find((p) => p.supports(url))
    if (!provider) throw new ProviderNotFoundError(url)
    return provider
  }

  listAll(): ScrapingProvider[] {
    return this._providers
  }

  reset(): void {
    this._providers = []
    this._resolveError = null
  }
}