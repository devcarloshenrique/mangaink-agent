export type ProviderEngine = 'api' | 'cheerio' | 'playwright'

export interface ProviderInfo {
  slug: string
  name: string
  engine: ProviderEngine
}

export interface ProviderSearchOptions {
  limit?: number
  offset?: number
  signal?: AbortSignal
}

export interface ProviderSearchResult {
  providerSlug: string
  title: string
  url: string
  coverUrl?: string | null
  author?: string | null
}
