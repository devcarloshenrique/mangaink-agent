import * as cheerio from 'cheerio'
import { createHttpClient } from '../../../../shared/http/http-client'
import { createSourceId } from '../../../../shared/utils/id-generator'
import type { ScrapingProvider } from '../provider.interface'
import type { ProviderEngine, ProviderInfo } from '../../types/provider.types'
import type { SourceInspectResponse } from '../../types/source.types'
import {
  buildProviderInfo,
  parseChapters,
  parseCover,
  parseMetadata,
  parseSourceInfo,
} from './mangalivre.parser'
import { ScrapingNetworkError } from '../../errors/scraping.errors'

const BASE_URL = 'https://mangalivre.to'

const http = createHttpClient({
  timeout: 30_000,
  headers: {
    Referer: `${BASE_URL}/`,
  },
  // Rate limit do MangaLivre: conservador, 3 tentativas com backoff agressivo
  retries: 3,
  retryDelay: 2_000,
})

export class MangalivreProvider implements ScrapingProvider {
  readonly slug = 'mangalivre'
  readonly name = 'Manga Livre'
  readonly engine: ProviderEngine = 'cheerio'
  readonly urlPattern = /mangalivre\.(to|net)\/manga\//
  readonly allowedDomains = ['mangalivre.to', 'mangalivre.net']

  supports(url: string): boolean {
    try {
      const { hostname } = new URL(url)
      return this.allowedDomains.includes(hostname)
    } catch {
      return false
    }
  }

  getInfo(): ProviderInfo {
    return buildProviderInfo()
  }

  async inspect(canonicalUrl: string): Promise<SourceInspectResponse> {
    let html: string
    try {
      const response = await http.get<string>(canonicalUrl)
      html = response.data
    } catch (err) {
      throw new ScrapingNetworkError(canonicalUrl, err)
    }

    const $ = cheerio.load(html)

    const sourceId = createSourceId(this.slug, canonicalUrl)
    const metadata = parseMetadata($, canonicalUrl)
    const covers = parseCover($, BASE_URL)
    const chapters = parseChapters($, BASE_URL)
    const source = parseSourceInfo(canonicalUrl)
    const provider = this.getInfo()

    return {
      sourceId,
      status: 'ready',
      provider,
      source,
      metadata,
      chapters,
      covers,
      statistics: {
        chapters: chapters.length,
        covers: covers.length,
      },
    }
  }
}
