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
import { ScrapingNetworkError, ScrapingParseError } from '../../errors/scraping.errors'
import {
  TAIYO_BASE_URL,
  TAIYO_MEILI_URL,
  TAIYO_MEILI_KEY,
  PROVIDER_INFO,
  parseTaiyoSearchResult,
  mapTaiyoToInspectResponse,
  parseTaiyoPages,
} from './taiyo.parser'
import type { TaiyoMeiliHit } from './taiyo.types'

const http = createHttpClient({
  timeout: 30_000,
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'x-trpc-source': 'nextjs-react',
    Referer: `${TAIYO_BASE_URL}/`,
  },
  retries: 3,
  retryDelay: 2_000,
})

export class TaiyoStrategy implements IProviderStrategy {
  readonly slug = 'taiyo'
  readonly name = 'Taiyo'
  readonly engine: ProviderEngine = 'api'
  readonly urlPattern = /taiyo\.moe\/media\//
  readonly allowedDomains = ['taiyo.moe', 'cdn.taiyo.moe', 'meilisearch.taiyo.moe']

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
    const url = `${TAIYO_MEILI_URL}/indexes/medias/search`

    try {
      const response = await this.rateLimiter.schedule(() =>
        http.post<{ hits: TaiyoMeiliHit[] }>(
          url,
          { q: query, limit },
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${TAIYO_MEILI_KEY}`,
            },
            signal: opts?.signal,
          },
        ),
      )

      const hits = response.data?.hits || []
      return hits.slice(0, limit).map((hit) => {
        const parsed = parseTaiyoSearchResult(hit)
        return {
          ...parsed,
          providerSlug: this.slug,
        }
      })
    } catch (err) {
      throw new ScrapingNetworkError(url, err)
    }
  }

  async inspect(canonicalUrl: string): Promise<SourceInspectResponse> {
    const mediaId = this.extractMediaId(canonicalUrl)
    if (!mediaId) {
      throw new ScrapingParseError(`Não foi possível extrair o mediaId da URL: ${canonicalUrl}`)
    }

    const mediaInput = JSON.stringify({ '0': { json: mediaId } })
    const mediaUrl = `${TAIYO_BASE_URL}/api/trpc/medias.getById?batch=1&input=${encodeURIComponent(mediaInput)}`

    let mediaData: any
    const allChapters: any[] = []

    try {
      const mediaRes = await this.rateLimiter.schedule(() =>
        http.get<any[]>(mediaUrl, {
          headers: {
            'x-trpc-source': 'nextjs-react',
            Referer: TAIYO_BASE_URL,
          },
        }),
      )
      mediaData = mediaRes.data?.[0]?.result?.data?.json

      let page = 1
      let totalPages = 1

      do {
        const chInput = JSON.stringify({ '0': { json: { mediaId, page, perPage: 100 } } })
        const chaptersUrl = `${TAIYO_BASE_URL}/api/trpc/chapters.getByMediaId?batch=1&input=${encodeURIComponent(chInput)}`

        const chRes = await this.rateLimiter.schedule(() =>
          http.get<any[]>(chaptersUrl, {
            headers: {
              'x-trpc-source': 'nextjs-react',
              Referer: TAIYO_BASE_URL,
            },
          }),
        )
        const resJson = chRes.data?.[0]?.result?.data?.json

        const pageChapters = resJson?.chapters || []
        allChapters.push(...pageChapters)

        totalPages = typeof resJson?.totalPages === 'number' ? resJson.totalPages : 1
        page++
      } while (page <= totalPages && page <= 200)
    } catch (err) {
      throw new ScrapingNetworkError(canonicalUrl, err)
    }

    return mapTaiyoToInspectResponse(mediaData || { id: mediaId }, allChapters, canonicalUrl)
  }

  async getChapterImages(chapterUrl: string): Promise<string[]> {
    const chapterId = this.extractChapterId(chapterUrl)
    if (!chapterId) {
      throw new ScrapingParseError(`Não foi possível extrair o chapterId da URL: ${chapterUrl}`)
    }

    const chInput = JSON.stringify({ '0': { json: chapterId } })
    const url = `${TAIYO_BASE_URL}/api/trpc/chapters.getById?batch=1&input=${encodeURIComponent(chInput)}`

    try {
      const response = await this.rateLimiter.schedule(() => http.get<any[]>(url))

      const detail = response.data?.[0]?.result?.data?.json
      if (!detail) return []

      const mediaId = detail.mediaId || detail.media?.id
      if (!mediaId) return []

      return parseTaiyoPages(detail, mediaId)
    } catch (err) {
      throw new ScrapingNetworkError(url, err)
    }
  }

  async downloadImage(imageUrl: string): Promise<{ buffer: Buffer; contentType: string }> {
    try {
      const response = await this.rateLimiter.schedule(() =>
        http.get(imageUrl, {
          responseType: 'arraybuffer',
          validateStatus: (status) => status === 200,
          headers: {
            Referer: `${TAIYO_BASE_URL}/`,
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

  private extractMediaId(url: string): string | null {
    const match = url.match(/\/media\/([a-zA-Z0-9_-]+)/)
    return match ? match[1] : null
  }

  private extractChapterId(url: string): string | null {
    const match = url.match(/\/chapter\/([a-zA-Z0-9_-]+)/)
    return match ? match[1] : null
  }
}
