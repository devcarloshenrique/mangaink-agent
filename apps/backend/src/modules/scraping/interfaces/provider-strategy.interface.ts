import type { ProviderEngine, ProviderInfo } from '../types/provider.types'
import type { SourceInspectResponse } from '../types/source.types'
import type { RateLimiter } from '../rate-limit/types'

/**
 * Interface base que todos os providers devem implementar.
 *
 * Um provider é responsável exclusivamente por extrair dados de uma fonte
 * e baixar imagens — encapsulando rate limiting, parsing e chamadas HTTP.
 */
export interface IProviderStrategy {
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
  /** Rate limiter compartilhado entre scraping e downloads */
  readonly rateLimiter: RateLimiter

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

  /**
   * Baixa uma imagem individual com rate limiting aplicado.
   * Retorna o buffer e o Content-Type para validação.
   */
  downloadImage(imageUrl: string): Promise<{ buffer: Buffer; contentType: string }>
}
