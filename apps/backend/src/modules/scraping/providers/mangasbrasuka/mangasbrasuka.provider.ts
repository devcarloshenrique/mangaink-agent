import { createHttpClient } from '../../../../shared/http/http-client'
import type { IProviderStrategy } from '../../interfaces/provider-strategy.interface'
import type { RateLimiter } from '../../rate-limit/types'
import type { ProviderEngine, ProviderInfo } from '../../types/provider.types'
import type { SourceInspectResponse } from '../../types/source.types'
import { ScrapingNetworkError, ScrapingParseError } from '../../errors/scraping.errors'
import {
  buildProviderInfo,
  getApiBase,
  getMangaSlug,
  mapObraToInspectResponse,
  mapPaginasToImageUrls,
  parseChapterUrl,
} from './mangasbrasuka.mapper'
import type { BrasukaObra, BrasukaCapitulo, BrasukaPagina } from './mangasbrasuka.types'

const BASE_URL = 'https://mangasbrasuka.com.br'

const http = createHttpClient({
  timeout: 30_000,
  headers: {
    'Content-Type': 'application/json',
    Referer: `${BASE_URL}/`,
    Origin: BASE_URL,
  },
  retries: 3,
  retryDelay: 2_000,
})

/** Página máxima por request na API de capítulos */
const CHAPTERS_PAGE_SIZE = 100

export class MangasBrasukaStrategy implements IProviderStrategy {
  readonly slug = 'mangasbrasuka'
  readonly name = 'Mangas Brasukas'
  readonly engine: ProviderEngine = 'api'
  readonly urlPattern = /mangasbrasuka\.com\.br\/(?:manga|manhwa|manhua|novel|light-novel)\//
  readonly allowedDomains = [
    'mangasbrasuka.com.br',
    'app.mangasbrasuka.com.br',
    'cdn.mugiverso.com',
  ]

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

  async inspect(canonicalUrl: string): Promise<SourceInspectResponse> {
    const slug = getMangaSlug(canonicalUrl)
    if (!slug || slug === 'unknown') {
      throw new ScrapingParseError(`Não foi possível extrair o slug da obra: ${canonicalUrl}`)
    }

    const obra = await this.fetchObraBySlug(slug)
    const chapters = await this.fetchAllChapters(slug)
    return mapObraToInspectResponse(obra, chapters, slug, canonicalUrl)
  }

  async getChapterImages(chapterUrl: string): Promise<string[]> {
    const parsed = parseChapterUrl(chapterUrl)
    if (!parsed) {
      throw new ScrapingParseError(
        `URL de capítulo inválida. Esperado: ${BASE_URL}/{manga|manhwa|manhua}/{slug}/{numero}`,
      )
    }

    const { slug, number } = parsed
    const pages = await this.fetchChapterPages(slug, number)
    const images = mapPaginasToImageUrls(pages)

    if (images.length === 0) {
      throw new ScrapingParseError(
        `Nenhuma imagem encontrada para o capítulo ${number} da obra ${slug}`,
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

  private async fetchObraBySlug(slug: string): Promise<BrasukaObra> {
    try {
      const res = await this.rateLimiter.schedule(() =>
        http.get(`${getApiBase()}/v1/www/works/${slug}`),
      )
      const data = res.data as { data?: BrasukaObra }

      if (!data?.data) {
        throw new Error(`API retornou erro para slug "${slug}": ${JSON.stringify(data)}`)
      }

      return data.data
    } catch (err) {
      if (err instanceof ScrapingNetworkError) throw err
      throw new ScrapingNetworkError(`${getApiBase()}/v1/www/works/${slug}`, err)
    }
  }

  private async fetchAllChapters(slug: string): Promise<BrasukaCapitulo[]> {
    const chapters: BrasukaCapitulo[] = []
    let page = 1

    for (;;) {
      let data: BrasukaCapitulo[]
      try {
        const res = await this.rateLimiter.schedule(() =>
          http.get(
            `${getApiBase()}/v1/www/works/${slug}/chapters?page=${page}&limit=${CHAPTERS_PAGE_SIZE}`,
          ),
        )
        const body = res.data as { data?: BrasukaCapitulo[] }
        data = body?.data ?? []
      } catch (err) {
        if (err instanceof ScrapingNetworkError) throw err
        throw new ScrapingNetworkError(
          `${getApiBase()}/v1/www/works/${slug}/chapters?page=${page}`,
          err,
        )
      }

      chapters.push(...data)
      if (data.length < CHAPTERS_PAGE_SIZE) break
      page += 1
    }

    return chapters
  }

  private async fetchChapterPages(slug: string, number: string): Promise<BrasukaPagina[]> {
    try {
      const res = await this.rateLimiter.schedule(() =>
        http.get(`${getApiBase()}/v1/www/works/${slug}/chapters/${number}/pages`),
      )
      const body = res.data as { data?: { pages?: BrasukaPagina[] } }

      if (!body?.data?.pages) {
        throw new Error(
          `API retornou erro para páginas do capítulo ${number} da obra ${slug}: ${JSON.stringify(body)}`,
        )
      }

      return body.data.pages
    } catch (err) {
      if (err instanceof ScrapingNetworkError) throw err
      throw new ScrapingNetworkError(
        `${getApiBase()}/v1/www/works/${slug}/chapters/${number}/pages`,
        err,
      )
    }
  }
}

/**
 * @deprecated Use MangasBrasukaStrategy
 */
export { MangasBrasukaStrategy as MangasBrasukaProvider }
