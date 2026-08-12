export class ScrapingError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message)
    this.name = 'ScrapingError'
  }
}

export class ProviderNotFoundError extends ScrapingError {
  constructor(url: string) {
    super(`Nenhum provider suporta a URL: ${url}`, 'PROVIDER_NOT_FOUND')
    this.name = 'ProviderNotFoundError'
  }
}

export class ProviderBySlugNotFoundError extends ScrapingError {
  constructor(slug: string) {
    super(`Provider não encontrado: ${slug}`, 'PROVIDER_BY_SLUG_NOT_FOUND')
    this.name = 'ProviderBySlugNotFoundError'
  }
}

export class InvalidUrlError extends ScrapingError {
  constructor(url: string) {
    super(`URL inválida ou não autorizada: ${url}`, 'INVALID_URL')
    this.name = 'InvalidUrlError'
  }
}

export class SourceNotFoundError extends ScrapingError {
  constructor(sourceId: string) {
    super(`Source não encontrada: ${sourceId}`, 'SOURCE_NOT_FOUND')
    this.name = 'SourceNotFoundError'
  }
}

export class ScrapingNetworkError extends ScrapingError {
  declare cause?: unknown

  constructor(url: string, cause?: unknown) {
    super(`Erro de rede ao acessar: ${url}`, 'NETWORK_ERROR')
    this.name = 'ScrapingNetworkError'
    this.cause = cause
  }
}

export class ScrapingParseError extends ScrapingError {
  constructor(detail: string) {
    super(`Erro de parsing: ${detail}`, 'PARSE_ERROR')
    this.name = 'ScrapingParseError'
  }
}
