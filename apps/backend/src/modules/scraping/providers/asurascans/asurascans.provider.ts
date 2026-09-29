import type { AxiosInstance } from 'axios'
import type { IProviderStrategy } from '../../interfaces/provider-strategy.interface'
import type {
  ProviderInfo,
  ProviderSearchOptions,
  ProviderSearchResult,
} from '../../types/provider.types'
import type { SourceInspectResponse } from '../../types/source.types'
import type { RateLimiter } from '../../rate-limit/types'
import { createRateLimiter } from '../../rate-limit/rate-limiter'
import { createHttpClient } from '../../../../shared/http/http-client'
import {
  ScrapingNetworkError,
  ScrapingParseError,
} from '../../errors/scraping.errors'
import {
  parseSearchResults,
  mapComicDetails,
  parseChapterImages,
  toAbsoluteUrl,
} from './asurascans.mapper'

const BASE_URL = 'https://asurascans.com'

export class AsuraScansStrategy implements IProviderStrategy {
  readonly slug = 'asurascans'
  readonly name = 'Asura Scans'
  readonly engine = 'cheerio' as const
  readonly allowedDomains: string[] = [
    'asurascans.com',
    'www.asurascans.com',
    'asuracomics.com',
    'www.asuracomics.com',
    'asuracomic.net',
    'cdn.asurascans.com',
  ]

  readonly urlPattern =
    /^https?:\/\/(?:www\.)?(?:asurascans\.com|asuracomics\.com|asuracomic\.net)\/comics\/([a-zA-Z0-9_-]+)(?:\/chapter\/[\d.]+)?\/?$/i

  readonly rateLimiter: RateLimiter
  private readonly client: AxiosInstance

  constructor(rateLimiter?: RateLimiter, client?: AxiosInstance) {
    this.rateLimiter =
      rateLimiter ??
      createRateLimiter({
        maxConcurrent: 3,
        minTime: 300,
      })
    this.client =
      client ??
      createHttpClient({
        allowedHosts: this.allowedDomains,
        timeout: 30_000,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          Referer: `${BASE_URL}/`,
        },
      })
  }

  getInfo(): ProviderInfo {
    return {
      slug: this.slug,
      name: this.name,
      engine: this.engine,
    }
  }

  supports(url: string): boolean {
    try {
      const parsed = new URL(url)
      const domainMatches = this.allowedDomains.some(
        (domain) => parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`),
      )
      return domainMatches && (this.urlPattern.test(url) || parsed.pathname.startsWith('/comics/'))
    } catch {
      return false
    }
  }

  async search(query: string, opts?: ProviderSearchOptions): Promise<ProviderSearchResult[]> {
    if (!query || !query.trim()) return []
    const cleanQuery = query.trim()
    const encoded = encodeURIComponent(cleanQuery)

    return this.rateLimiter.schedule(async () => {
      // 1. Tenta /comics?name=query
      try {
        const url = `${BASE_URL}/comics?name=${encoded}`
        const res = await this.client.get<string>(url, { signal: opts?.signal })
        const results = parseSearchResults(res.data, BASE_URL)
        if (results.length > 0) {
          return typeof opts?.limit === 'number' ? results.slice(0, opts.limit) : results
        }
      } catch {
        // Fallback
      }

      // 2. Fallback para /browse?search=query
      try {
        const url = `${BASE_URL}/browse?search=${encoded}`
        const res = await this.client.get<string>(url, { signal: opts?.signal })
        const results = parseSearchResults(res.data, BASE_URL)
        return typeof opts?.limit === 'number' ? results.slice(0, opts.limit) : results
      } catch (err: any) {
        throw new ScrapingNetworkError(
          `${BASE_URL}/browse (${err?.message || String(err)})`,
          err,
        )
      }
    })
  }

  async inspect(
    canonicalUrl: string,
    opts?: { signal?: AbortSignal },
  ): Promise<SourceInspectResponse> {
    if (!this.supports(canonicalUrl)) {
      throw new ScrapingParseError(`URL não suportada pelo provider ${this.name}: ${canonicalUrl}`)
    }

    // Normaliza URL caso tenha sido passado o link de um capítulo (/comics/{slug}/chapter/{ch})
    let targetUrl = canonicalUrl
    const match = canonicalUrl.match(this.urlPattern)
    if (match && match[1]) {
      targetUrl = `${BASE_URL}/comics/${match[1]}`
    }

    return this.rateLimiter.schedule(async () => {
      let html: string
      try {
        const res = await this.client.get<string>(targetUrl, {
          signal: opts?.signal,
        })
        html = res.data
      } catch (err: any) {
        throw new ScrapingNetworkError(targetUrl, err)
      }

      try {
        const result = mapComicDetails(html, targetUrl, this.getInfo())
        if (!result.metadata.title || result.metadata.title === 'Sem título') {
          throw new Error('Título não encontrado na página da série')
        }
        return result
      } catch (err: any) {
        if (err instanceof ScrapingParseError) throw err
        throw new ScrapingParseError(
          `Falha ao mapear detalhes da obra no Asura Scans: ${err.message}`,
        )
      }
    })
  }

  async getChapterImages(
    chapterUrl: string,
    opts?: { signal?: AbortSignal },
  ): Promise<string[]> {
    if (!this.supports(chapterUrl)) {
      throw new ScrapingParseError(`URL não suportada pelo provider ${this.name}: ${chapterUrl}`)
    }

    return this.rateLimiter.schedule(async () => {
      let html: string
      try {
        const res = await this.client.get<string>(chapterUrl, {
          signal: opts?.signal,
        })
        html = res.data
      } catch (err: any) {
        throw new ScrapingNetworkError(chapterUrl, err)
      }

      const images = parseChapterImages(html)
      if (images.length === 0) {
        throw new ScrapingParseError(
          `Nenhuma imagem encontrada para o capítulo no Asura Scans: ${chapterUrl}`,
        )
      }

      return images
    })
  }

  async downloadImage(imageUrl: string): Promise<{ buffer: Buffer; contentType: string }> {
    return this.rateLimiter.schedule(async () => {
      try {
        const res = await this.client.get<ArrayBuffer>(imageUrl, {
          responseType: 'arraybuffer',
          headers: {
            Referer: `${BASE_URL}/`,
          },
        })
        const contentType = (res.headers['content-type'] as string) || 'image/jpeg'
        return {
          buffer: Buffer.from(res.data),
          contentType,
        }
      } catch (err: any) {
        throw new ScrapingNetworkError(imageUrl, err)
      }
    })
  }
}

export const AsuraScansProvider = AsuraScansStrategy
