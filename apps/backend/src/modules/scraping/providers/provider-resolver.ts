import type { ScrapingProvider } from './provider.interface'
import { MangalivreProvider } from './mangalivre/mangalivre.provider'
import { ProviderNotFoundError, InvalidUrlError } from '../errors/scraping.errors'

/** Registry de providers disponíveis. Para adicionar um novo, basta incluir aqui. */
const PROVIDERS: ScrapingProvider[] = [new MangalivreProvider()]

/**
 * Descobre e retorna o provider correto para uma URL.
 * Valida o formato da URL e lança erro se não houver provider compatível.
 */
export class ProviderResolver {
  /**
   * Resolve o provider pela URL.
   * @throws {InvalidUrlError} se a URL for inválida
   * @throws {ProviderNotFoundError} se nenhum provider suportar a URL
   */
  resolve(url: string): ScrapingProvider {
    // Valida que é uma URL válida
    try {
      new URL(url)
    } catch {
      throw new InvalidUrlError(url)
    }

    const provider = PROVIDERS.find((p) => p.supports(url))
    if (!provider) throw new ProviderNotFoundError(url)

    return provider
  }

  /** Lista todos os providers disponíveis. */
  listAll(): ScrapingProvider[] {
    return PROVIDERS
  }
}

export { PROVIDERS }
