import { createHttpClient } from '../../../../shared/http/http-client'
import type { IProviderStrategy } from '../../interfaces/provider-strategy.interface'
import type { RateLimiter } from '../../rate-limit/types'
import type { ProviderEngine, ProviderInfo } from '../../types/provider.types'
import type { SourceInspectResponse } from '../../types/source.types'
import { ScrapingNetworkError, ScrapingParseError } from '../../errors/scraping.errors'
import {
  API_BASE,
  BASE_URL,
  buildProviderInfo,
  extractChapterId,
  extractMangaId,
  mapAtHomeToImageUrls,
  mapMangaToInspectResponse,
  PROVIDER_SLUG,
} from './mangadex.mapper'
import type {
  MangaDexAtHomeResponse,
  MangaDexChapterData,
  MangaDexChapterListResponse,
  MangaDexMangaData,
  MangaDexMangaResponse,
} from './mangadex.types'

const http = createHttpClient({
  timeout: 30_000,
  headers: {
    'Content-Type': 'application/json',
    'User-Agent': 'MangaInkAgent/1.0 (https://github.com/devcarloshenrique/mangaink-agent)',
  },
  retries: 3,
  retryDelay: 2_000,
})

const CHAPTERS_PAGE_SIZE = 100

export class MangaDexStrategy implements IProviderStrategy {
  readonly slug = PROVIDER_SLUG
  readonly name = 'MangaDex'
  readonly engine: ProviderEngine = 'api'
  readonly urlPattern = /mangadex\.org\/(?:title|chapter)\//
  readonly allowedDomains = [
    'mangadex.org',
    'api.mangadex.org',
    'uploads.mangadex.org',
  ]

  constructor(readonly rateLimiter: RateLimiter) {}

  supports(url: string): boolean {
    try {
      const { hostname } = new URL(url)
      if (this.allowedDomains.includes(hostname)) return true
      if (hostname.endsWith('.mangadex.network')) return true
      return false
    } catch {
      return false
    }
  }

  getInfo(): ProviderInfo {
    return buildProviderInfo()
  }

  async inspect(canonicalUrl: string): Promise<SourceInspectResponse> {
    const mangaId = extractMangaId(canonicalUrl)
    if (!mangaId) {
      throw new ScrapingParseError(
        `Não foi possível extrair o ID da obra a partir da URL: ${canonicalUrl}. Formato esperado: https://mangadex.org/title/{id}`,
      )
    }

    const manga = await this.fetchMangaById(mangaId)
    const chapters = await this.fetchAllPtChapters(mangaId)
    return mapMangaToInspectResponse(manga, chapters, canonicalUrl)
  }

  async getChapterImages(chapterUrl: string): Promise<string[]> {
    const chapterId = extractChapterId(chapterUrl)
    if (!chapterId) {
      throw new ScrapingParseError(
        `URL de capítulo inválida: ${chapterUrl}. Formato esperado: https://mangadex.org/chapter/{id}`,
      )
    }

    const atHome = await this.fetchAtHomeServer(chapterId)
    const images = mapAtHomeToImageUrls(atHome)

    if (images.length === 0) {
      throw new ScrapingParseError(
        `Nenhuma imagem encontrada para o capítulo ${chapterId} no MangaDex`,
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

  // ─── API Helpers (privados) ─────────────────────────────────────────────

  private async fetchMangaById(mangaId: string): Promise<MangaDexMangaData> {
    try {
      const res = await this.rateLimiter.schedule(() =>
        http.get<MangaDexMangaResponse>(
          `${API_BASE}/manga/${mangaId}?includes[]=cover_art&includes[]=author&includes[]=artist`,
        ),
      )
      const data = res.data

      if (!data?.data?.id) {
        throw new Error(`MangaDex retornou resposta inválida para ID "${mangaId}"`)
      }

      return data.data
    } catch (err) {
      if (err instanceof ScrapingNetworkError) throw err
      throw new ScrapingNetworkError(`${API_BASE}/manga/${mangaId}`, err)
    }
  }

  private async fetchAllPtChapters(mangaId: string): Promise<MangaDexChapterData[]> {
    const chapters: MangaDexChapterData[] = []
    let offset = 0

    for (;;) {
      let data: MangaDexChapterData[]
      let total = 0
      try {
        const url = `${API_BASE}/chapter?manga=${mangaId}&translatedLanguage[]=pt-br&translatedLanguage[]=pt&limit=${CHAPTERS_PAGE_SIZE}&offset=${offset}&order[chapter]=asc`
        const res = await this.rateLimiter.schedule(() =>
          http.get<MangaDexChapterListResponse>(url),
        )
        const body = res.data
        data = body?.data ?? []
        total = body?.total ?? 0
      } catch (err) {
        if (err instanceof ScrapingNetworkError) throw err
        throw new ScrapingNetworkError(
          `${API_BASE}/chapter?manga=${mangaId}&offset=${offset}`,
          err,
        )
      }

      chapters.push(...data)
      if (chapters.length >= total || data.length === 0) break
      offset += CHAPTERS_PAGE_SIZE
    }

    return chapters
  }

  private async fetchAtHomeServer(chapterId: string): Promise<MangaDexAtHomeResponse> {
    try {
      const res = await this.rateLimiter.schedule(() =>
        http.get<MangaDexAtHomeResponse>(`${API_BASE}/at-home/server/${chapterId}`),
      )
      const data = res.data

      if (!data?.baseUrl || !data.chapter?.data) {
        throw new Error(
          `MangaDex At-Home retornou resposta inválida para capítulo "${chapterId}"`,
        )
      }

      return data
    } catch (err) {
      if (err instanceof ScrapingNetworkError) throw err
      throw new ScrapingNetworkError(`${API_BASE}/at-home/server/${chapterId}`, err)
    }
  }
}
