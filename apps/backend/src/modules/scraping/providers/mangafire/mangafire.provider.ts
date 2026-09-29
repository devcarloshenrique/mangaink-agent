import type { AxiosInstance } from 'axios'
import type { IProviderStrategy } from '../../interfaces/provider-strategy.interface'
import type {
  ProviderEngine,
  ProviderInfo,
  ProviderSearchResult,
  ProviderSearchOptions,
} from '../../types/provider.types'
import type { SourceInspectResponse } from '../../types/source.types'
import type { RateLimiter } from '../../rate-limit/types'
import {
  ScrapingNetworkError,
  SourceNotFoundError,
  InvalidUrlError,
  ScrapingParseError,
} from '../../errors/scraping.errors'
import { createHttpClient } from '../../../../shared/http/http-client'
import type {
  MangaFireSearchResponse,
  MangaFireTitleDetailResponse,
  MangaFireChapterListResponse,
  MangaFireChapterPagesResponse,
  MangaFireChapterItem,
} from './mangafire.types'
import {
  extractMangaId,
  extractChapterId,
  parseSearchResults,
  mapToSourceInspectResponse,
  mapToPages,
} from './mangafire.mapper'
import { getVrfToken } from './mangafire.vrf'

export class MangaFireStrategy implements IProviderStrategy {
  readonly slug = 'mangafire'
  readonly name = 'MangaFire'
  readonly engine: ProviderEngine = 'api'
  readonly urlPattern = /^(?:https?:\/\/)?(?:www\.)?mangafire\.(?:to|sx|is)(?:\/|$)/i
  readonly allowedDomains = [
    'mangafire.to',
    'www.mangafire.to',
    'mangafire.sx',
    'www.mangafire.sx',
    'mangafire.is',
    'www.mangafire.is',
    's.mfcdn.nl',
    'static.mfcdn.nl',
  ]

  readonly rateLimiter: RateLimiter
  private readonly baseUrl = 'https://mangafire.to'
  private readonly client: AxiosInstance

  constructor(
    rateLimiter: RateLimiter,
    client?: AxiosInstance
  ) {
    this.rateLimiter = rateLimiter
    this.client =
      client ??
      createHttpClient({
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'application/json, text/plain, */*',
          Referer: `${this.baseUrl}/`,
        },
      })
  }

  supports(url: string): boolean {
    try {
      const parsed = new URL(url)
      const hostname = parsed.hostname.toLowerCase()
      return (
        hostname === 'mangafire.to' ||
        hostname.endsWith('.mangafire.to') ||
        hostname === 'mangafire.sx' ||
        hostname.endsWith('.mangafire.sx') ||
        hostname === 'mangafire.is' ||
        hostname.endsWith('.mangafire.is')
      )
    } catch {
      return false
    }
  }

  getInfo(): ProviderInfo {
    return {
      slug: this.slug,
      name: this.name,
      engine: this.engine,
    }
  }

  async search(
    query: string,
    opts?: ProviderSearchOptions
  ): Promise<ProviderSearchResult[]> {
    if ((opts?.offset ?? 0) > 0) return []
    const trimmed = query.trim()
    if (trimmed.length === 0) return []

    const limit = opts?.limit ?? 10
    const apiPath = '/api/titles'
    const params: Record<string, any> = {
      keyword: trimmed,
      page: 1,
      limit,
    }

    try {
      const vrf = await getVrfToken(apiPath, params)
      const response = await this.rateLimiter.schedule(() =>
        this.client.get<MangaFireSearchResponse>(`${this.baseUrl}${apiPath}`, {
          params: {
            ...params,
            vrf,
          },
        })
      )

      return parseSearchResults(response.data, this.baseUrl)
    } catch (error: any) {
      if (error instanceof ScrapingNetworkError) throw error
      throw new ScrapingNetworkError(
        `${this.baseUrl}${apiPath}`,
        error
      )
    }
  }

  async inspect(canonicalUrl: string): Promise<SourceInspectResponse> {
    if (!this.supports(canonicalUrl)) {
      throw new InvalidUrlError(canonicalUrl)
    }

    const hid = extractMangaId(canonicalUrl)
    if (!hid) {
      throw new InvalidUrlError(canonicalUrl)
    }

    const titleApiPath = `/api/titles/${hid}`

    let detailData: any
    try {
      const titleVrf = await getVrfToken(titleApiPath, {})
      const titleResponse = await this.rateLimiter.schedule(() =>
        this.client.get<MangaFireTitleDetailResponse>(
          `${this.baseUrl}${titleApiPath}`,
          {
            params: { vrf: titleVrf },
          }
        )
      )

      detailData = titleResponse.data?.data || titleResponse.data
      if (!detailData || (!detailData.title && !detailData.name && !detailData.hid)) {
        throw new SourceNotFoundError(canonicalUrl)
      }
      if (!detailData.hid) detailData.hid = hid
      if (!detailData.title && detailData.name) detailData.title = detailData.name
    } catch (error: any) {
      if (
        error instanceof SourceNotFoundError ||
        error instanceof InvalidUrlError
      ) {
        throw error
      }
      if (error.response?.status === 404) {
        throw new SourceNotFoundError(canonicalUrl)
      }
      throw new ScrapingNetworkError(
        canonicalUrl,
        error
      )
    }

    // Full chapter pagination
    const chaptersApiPath = `/api/titles/${hid}/chapters`
    const allChapters: MangaFireChapterItem[] = []
    let page = 1
    const limit = 100
    let hasMore = true

    while (hasMore) {
      const paginationParams: Record<string, any> = {
        page,
        limit,
      }

      try {
        const chVrf = await getVrfToken(chaptersApiPath, paginationParams)
        const chResponse = await this.rateLimiter.schedule(() =>
          this.client.get<MangaFireChapterListResponse>(
            `${this.baseUrl}${chaptersApiPath}`,
            {
              params: {
                ...paginationParams,
                vrf: chVrf,
              },
            }
          )
        )

        const items = chResponse.data?.items || []
        allChapters.push(...items)

        const meta = chResponse.data?.meta
        if (!meta || !meta.hasNext || page >= meta.lastPage || items.length === 0) {
          hasMore = false
        } else {
          page++
        }
      } catch {
        hasMore = false
      }
    }

    return mapToSourceInspectResponse(
      detailData,
      allChapters,
      canonicalUrl,
      this.baseUrl,
      this.getInfo()
    )
  }

  async getChapterImages(chapterUrl: string): Promise<string[]> {
    const chapterId = extractChapterId(chapterUrl)
    if (!chapterId) {
      throw new InvalidUrlError(chapterUrl)
    }

    const chapterApiPath = `/api/chapters/${chapterId}`

    try {
      const vrf = await getVrfToken(chapterApiPath, {})
      const response = await this.rateLimiter.schedule(() =>
        this.client.get<MangaFireChapterPagesResponse>(
          `${this.baseUrl}${chapterApiPath}`,
          {
            params: { vrf },
          }
        )
      )

      const pages = mapToPages(response.data)
      if (pages.length === 0) {
        throw new ScrapingParseError(
          'Nenhuma imagem de página foi encontrada para o capítulo no MangaFire.'
        )
      }

      return pages
    } catch (error: any) {
      if (
        error instanceof ScrapingParseError ||
        error instanceof InvalidUrlError
      ) {
        throw error
      }
      if (error.response?.status === 404) {
        throw new SourceNotFoundError(chapterUrl)
      }
      throw new ScrapingNetworkError(
        chapterUrl,
        error
      )
    }
  }

  async downloadImage(
    imageUrl: string
  ): Promise<{ buffer: Buffer; contentType: string }> {
    return this.rateLimiter.schedule(async () => {
      try {
        const response = await this.client.get(imageUrl, {
          responseType: 'arraybuffer',
          headers: {
            Referer: `${this.baseUrl}/`,
            Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          },
        })

        const rawContentType = response.headers['content-type']
        const contentType =
          typeof rawContentType === 'string' ? rawContentType : 'image/jpeg'
        return {
          buffer: Buffer.from(response.data),
          contentType,
        }
      } catch (error: any) {
        throw new ScrapingNetworkError(
          imageUrl,
          error
        )
      }
    })
  }
}
