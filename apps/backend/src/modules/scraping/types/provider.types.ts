export type ProviderEngine = 'api' | 'cheerio' | 'playwright'

export interface ProviderInfo {
  slug: string
  name: string
  engine: ProviderEngine
}
