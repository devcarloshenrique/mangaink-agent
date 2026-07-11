import type { ProviderEngine, ProviderInfo } from '../types/provider.types'
import type { SourceInspectResponse } from '../types/source.types'

/**
 * Interface base que todos os providers devem implementar.
 *
 * Um provider é responsável exclusivamente por extrair dados de uma fonte —
 * sem regras de negócio, cache ou I/O de storage.
 */
export interface ScrapingProvider {
  /** Identificador único do provider (ex: 'mangalivre') */
  readonly slug: string
  /** Nome de exibição (ex: 'Manga Livre') */
  readonly name: string
  /** Motor de extração utilizado */
  readonly engine: ProviderEngine
  /** Padrão de URL que o provider suporta */
  readonly urlPattern: RegExp
  /** Domínios autorizados (SSRF protection) */
  readonly allowedDomains: string[]

  /**
   * Verifica se o provider suporta a URL fornecida.
   */
  supports(url: string): boolean

  /**
   * Informa o ProviderInfo para uso na resposta da API.
   */
  getInfo(): ProviderInfo

  /**
   * Realiza o scraping da URL e retorna os dados da obra.
   * Recebe a URL já normalizada (canonical).
   */
  inspect(canonicalUrl: string): Promise<SourceInspectResponse>

  /**
   * Extrai as URLs das imagens de um capítulo específico.
   * Recebe a URL da página do capítulo.
   * Retorna uma lista de URLs absolutas das imagens.
   */
  getChapterImages(chapterUrl: string): Promise<string[]>
}
