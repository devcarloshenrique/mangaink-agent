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
  mapSeriesDetails,
  parseApiSeriesResults,
  parseBrowseHtml,
  parseChapterImages,
} from './flamecomics.mapper'
import type { FlameComicsSeriesApiItem } from './flamecomics.types'

const BASE_URL = 'https://flamecomics.xyz'

export class FlameComicsStrategy implements IProviderStrategy {
  readonly slug = 'flamecomics'
  readonly name = 'Flame Comics'
  readonly engine = 'cheerio' as const
  readonly allowedDomains: string[] = [
    'flamecomics.xyz',
    'www.flamecomics.xyz',
    'flamecomics.me',
    'www.flamecomics.me',
    'flamecomics.com',
    'www.flamecomics.com',
    'cdn.flamecomics.xyz',
    'flamescans.org',
  ]

  readonly urlPattern =
    /^https?:\/\/(?:www\.)?(?:flamecomics\.(?:xyz|me|com)|flamescans\.org)\/series\/(\d+)(?:-[a-zA-Z0-9_-]+)?(?:\/([a-zA-Z0-9_-]+))?\/?$/i

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
      return domainMatches && (this.urlPattern.test(url) || parsed.pathname.startsWith('/series/'))
    } catch {
      return false
    }
  }

  async search(query: string, opts?: ProviderSearchOptions): Promise<ProviderSearchResult[]> {
    // 1. Tenta a API rápida interna (/api/series)
    try {
      return await this.rateLimiter.schedule(async () => {
        const res = await this.client.get<FlameComicsSeriesApiItem[]>(`${BASE_URL}/api/series`, {
          signal: opts?.signal,
        })
        if (Array.isArray(res.data)) {
          return parseApiSeriesResults(res.data, query, this.getInfo(), opts?.limit)
        }
        throw new Error('API não retornou um array de séries válido')
      })
    } catch {
      // 2. Fallback para a página /browse
      return this.rateLimiter.schedule(async () => {
        try {
          const res = await this.client.get<string>(`${BASE_URL}/browse`, {
            signal: opts?.signal,
          })
          return parseBrowseHtml(res.data, query, this.getInfo(), opts?.limit)
        } catch (err: any) {
          throw new ScrapingNetworkError(
            `${BASE_URL}/browse (${err?.message || String(err)})`,
            err,
          )
        }
      })
    }
  }

  async inspect(
    canonicalUrl: string,
    opts?: { signal?: AbortSignal },
  ): Promise<SourceInspectResponse> {
    if (!this.supports(canonicalUrl)) {
      throw new ScrapingParseError(`URL não suportada pelo provider ${this.name}: ${canonicalUrl}`)
    }

    // Normaliza URL caso tenha sido passado o link de um capítulo (/series/{id}/{token})
    let targetUrl = canonicalUrl
    const match = canonicalUrl.match(this.urlPattern)
    if (match && match[1]) {
      targetUrl = `${BASE_URL}/series/${match[1]}`
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
        const result = mapSeriesDetails(html, targetUrl, this.getInfo())
        if (!result.metadata.title || result.metadata.title === 'Sem título') {
          throw new Error('Título não encontrado na página da série')
        }
        return result
      } catch (err: any) {
        if (err instanceof ScrapingParseError) throw err
        throw new ScrapingParseError(
          `Falha ao mapear detalhes da obra no Flame Comics: ${err.message}`,
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
          `Nenhuma imagem encontrada para o capítulo no Flame Comics: ${chapterUrl}`,
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

export const FlameComicsProvider = FlameComicsStrategy
