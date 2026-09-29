import { createHttpClient } from '../../../../shared/http/http-client'
import type { IProviderStrategy } from '../../interfaces/provider-strategy.interface'
import type { RateLimiter } from '../../rate-limit/types'
import type {
  ProviderEngine,
  ProviderInfo,
  ProviderSearchOptions,
  ProviderSearchResult,
} from '../../types/provider.types'
import type { SourceInspectResponse } from '../../types/source.types'
import { ScrapingNetworkError } from '../../errors/scraping.errors'
import * as cheerio from 'cheerio'
import {
  MANGAPILL_BASE_URL,
  PROVIDER_INFO,
  parseMangapillSearchResult,
  mapMangapillToInspectResponse,
  parseMangapillChapterImages,
} from './mangapill.parser'

const http = createHttpClient({
  timeout: 10_000,
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    Referer: `${MANGAPILL_BASE_URL}/`,
  },
  retries: 2,
  retryDelay: 1_000,
})

export class MangapillStrategy implements IProviderStrategy {
  readonly slug = 'mangapill'
  readonly name = 'Mangapill'
  readonly engine: ProviderEngine = 'cheerio'
  readonly urlPattern = /mangapill\.com\/manga\//
  readonly allowedDomains = ['mangapill.com', 'cdn.readdetectiveconan.com']

  constructor(readonly rateLimiter: RateLimiter) {}

  supports(url: string): boolean {
    try {
      const parsed = new URL(url)
      if (!this.allowedDomains.includes(parsed.hostname)) return false
      return this.urlPattern.test(url)
    } catch {
      return false
    }
  }

  getInfo(): ProviderInfo {
    return PROVIDER_INFO
  }

  async search(query: string, opts?: ProviderSearchOptions): Promise<ProviderSearchResult[]> {
    if ((opts?.offset ?? 0) > 0) return []
    const limit = opts?.limit ?? 10
    const url = `${MANGAPILL_BASE_URL}/search?q=${encodeURIComponent(query)}`

    try {
      const response = await this.rateLimiter.schedule(() =>
        http.get<string>(url, { signal: opts?.signal }),
      )

      const $ = cheerio.load(response.data)
      const results = parseMangapillSearchResult($, MANGAPILL_BASE_URL)
      return results.slice(0, limit).map((r) => ({
        ...r,
        providerSlug: this.slug,
      }))
    } catch (err) {
      throw new ScrapingNetworkError(url, err)
    }
  }

  async inspect(canonicalUrl: string): Promise<SourceInspectResponse> {
    try {
      const response = await this.rateLimiter.schedule(() =>
        http.get<string>(canonicalUrl),
      )

      const $ = cheerio.load(response.data)
      return mapMangapillToInspectResponse($, canonicalUrl)
    } catch (err) {
      throw new ScrapingNetworkError(canonicalUrl, err)
    }
  }

  async getChapterImages(chapterUrl: string): Promise<string[]> {
    try {
      const response = await this.rateLimiter.schedule(() =>
        http.get<string>(chapterUrl),
      )

      const $ = cheerio.load(response.data)
      return parseMangapillChapterImages($)
    } catch (err) {
      throw new ScrapingNetworkError(chapterUrl, err)
    }
  }

  async downloadImage(imageUrl: string): Promise<{ buffer: Buffer; contentType: string }> {
    try {
      const response = await this.rateLimiter.schedule(() =>
        http.get(imageUrl, {
          responseType: 'arraybuffer',
          validateStatus: (status) => status === 200,
          headers: {
            Referer: `${MANGAPILL_BASE_URL}/`,
          },
        }),
      )

      const buffer = Buffer.from(response.data)
      const contentType =
        typeof response.headers['content-type'] === 'string'
          ? response.headers['content-type']
          : Array.isArray(response.headers['content-type'])
            ? (response.headers['content-type'][0] ?? '')
            : ''

      return { buffer, contentType: contentType || 'application/octet-stream' }
    } catch (err) {
      throw new ScrapingNetworkError(imageUrl, err)
    }
  }
}
