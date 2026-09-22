import * as cheerio from 'cheerio'
import { createHttpClient } from '../../../../shared/http/http-client'
import { createSourceId } from '../../../../shared/utils/id-generator'
import type { IProviderStrategy } from '../../interfaces/provider-strategy.interface'
import type { RateLimiter } from '../../rate-limit/types'
import type {
  ProviderEngine,
  ProviderInfo,
  ProviderSearchOptions,
  ProviderSearchResult,
} from '../../types/provider.types'
import type { SourceInspectResponse } from '../../types/source.types'
import {
  buildProviderInfo,
  parseChapterImages,
  parseChapters,
  parseCover,
  parseMetadata,
  parseSearchResults,
  parseSourceInfo,
} from './mangalivre.parser'
import { ScrapingNetworkError, ScrapingParseError } from '../../errors/scraping.errors'

const BASE_URL = 'https://mangalivre.to'

const http = createHttpClient({
  timeout: 30_000,
  headers: {
    Referer: `${BASE_URL}/`,
  },
  retries: 3,
  retryDelay: 2_000,
})

export class MangaLivreStrategy implements IProviderStrategy {
  readonly slug = 'mangalivre'
  readonly name = 'Manga Livre'
  readonly engine: ProviderEngine = 'cheerio'
  readonly urlPattern = /mangalivre\.to\/manga\//
  readonly allowedDomains = ['mangalivre.to']

  constructor(readonly rateLimiter: RateLimiter) {}
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

  async search(query: string, opts?: ProviderSearchOptions): Promise<ProviderSearchResult[]> {
    if ((opts?.offset ?? 0) > 0) return []
    const limit = opts?.limit ?? 10
    const url = `${BASE_URL}/?s=${encodeURIComponent(query)}&post_type=wp-manga`
    let html: string
    try {
      const response = await this.rateLimiter.schedule(() =>
        http.get<string>(url, { signal: opts?.signal }),
      )
      html = response.data
    } catch (err) {
      throw new ScrapingNetworkError(url, err)
    }

    const $ = cheerio.load(html)
    return parseSearchResults($, BASE_URL)
      .filter((r) => this.urlPattern.test(r.url))
      .slice(0, limit)
      .map((r) => ({ ...r, providerSlug: this.slug }))
  }

  async inspect(canonicalUrl: string): Promise<SourceInspectResponse> {
    let html: string
    try {
      const response = await this.rateLimiter.schedule(() => http.get<string>(canonicalUrl))
      html = response.data
    } catch (err) {
      throw new ScrapingNetworkError(canonicalUrl, err)
    }

    const $ = cheerio.load(html)

    const sourceId = createSourceId(this.slug, canonicalUrl)
    const metadata = parseMetadata($, canonicalUrl)
    const covers = parseCover($, BASE_URL)
    const chapters = parseChapters($, BASE_URL, canonicalUrl)
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

  async getChapterImages(chapterUrl: string): Promise<string[]> {
    let html: string
    try {
      const response = await this.rateLimiter.schedule(() =>
        http.get<string>(chapterUrl, {
          headers: { Referer: chapterUrl },
        }),
      )
      html = response.data
    } catch (err) {
      throw new ScrapingNetworkError(chapterUrl, err)
    }

    const $ = cheerio.load(html)
    const images = parseChapterImages($, chapterUrl)

    if (images.length === 0) {
      throw new ScrapingParseError(
        `Nenhuma imagem encontrada na página do capítulo: ${chapterUrl}`,
      )
    }

    return images
  }

  async downloadImage(imageUrl: string): Promise<{ buffer: Buffer; contentType: string }> {
    try {
      const response = await this.rateLimiter.schedule(() =>
        http.get(imageUrl, {
          responseType: 'arraybuffer',
          validateStatus: (status) => status === 200,
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

export { MangaLivreStrategy as MangalivreProvider }
