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
  API_BASE,
  BASE_URL,
  buildProviderInfo,
  extractChapterId,
  extractLanguage,
  extractMangaId,
  mapAtHomeToImageUrls,
  mapMangaToInspectResponse,
  PROVIDER_SLUG,
  UPLOADS_BASE,
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

interface MangaDexMangaListResponse {
  result: string
  data: MangaDexMangaData[]
}

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

  async search(query: string, opts?: ProviderSearchOptions): Promise<ProviderSearchResult[]> {
    const limit = opts?.limit ?? 10
    const offset = opts?.offset ?? 0
    const langParams = buildLanguageParams(opts?.language)
    const url =
      `${API_BASE}/manga?title=${encodeURIComponent(query)}` +
      `&limit=${limit}&offset=${offset}&includes[]=cover_art&includes[]=author${langParams}`
    let items: MangaDexMangaData[]
    try {
      const res = await this.rateLimiter.schedule(() =>
        http.get<MangaDexMangaListResponse>(url, { signal: opts?.signal }),
      )
      items = res.data?.data ?? []
    } catch (err) {
      if (err instanceof ScrapingNetworkError) throw err
      throw new ScrapingNetworkError(url, err)
    }

    const langParam =
      opts?.language && opts.language !== 'all'
        ? `?lang=${encodeURIComponent(opts.language.toLowerCase().trim())}`
        : ''

    return items.slice(0, limit).map((manga) => ({
      providerSlug: this.slug,
      title: resolveSearchTitle(manga, opts?.language),
      url: `${BASE_URL}/title/${manga.id}${langParam}`,
      coverUrl: resolveSearchCover(manga),
      author: resolveSearchAuthor(manga),
      type: resolveSearchWorkType(manga.attributes?.originalLanguage),
      genres: resolveSearchGenres(manga),
    }))
  }

  async inspect(canonicalUrl: string): Promise<SourceInspectResponse> {
    const mangaId = extractMangaId(canonicalUrl)
    if (!mangaId) {
      throw new ScrapingParseError(
        `Não foi possível extrair o ID da obra a partir da URL: ${canonicalUrl}. Formato esperado: https://mangadex.org/title/{id}`,
      )
    }

    const language = extractLanguage(canonicalUrl)
    const manga = await this.fetchMangaById(mangaId)
    const chapters = await this.fetchAllChapters(mangaId, language)
    return mapMangaToInspectResponse(manga, chapters, canonicalUrl, language)
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

  private async fetchAllChapters(mangaId: string, language: string): Promise<MangaDexChapterData[]> {
    const chapters: MangaDexChapterData[] = []
    let offset = 0
    let langQuery: string

    const lang = language.toLowerCase().trim()
    if (lang === 'pt-br' || lang === 'pt') {
      langQuery = 'translatedLanguage[]=pt-br&translatedLanguage[]=pt'
    } else if (lang === 'es') {
      langQuery = 'translatedLanguage[]=es&translatedLanguage[]=es-la'
    } else if (lang === 'zh') {
      langQuery = 'translatedLanguage[]=zh&translatedLanguage[]=zh-hk&translatedLanguage[]=zh-ro'
    } else if (lang === 'all') {
      langQuery = ''
    } else {
      langQuery = `translatedLanguage[]=${encodeURIComponent(lang)}`
    }

    const langSuffix = langQuery ? `&${langQuery}` : ''

    for (;;) {
      let data: MangaDexChapterData[]
      try {
        const res = await this.rateLimiter.schedule(() =>
          http.get<MangaDexChapterListResponse>(
            `${API_BASE}/manga/${mangaId}/feed?limit=${CHAPTERS_PAGE_SIZE}&offset=${offset}&order[chapter]=asc&includes[]=scanlation_group${langSuffix}`,
          ),
        )
        data = res.data?.data ?? []
      } catch (err) {
        if (err instanceof ScrapingNetworkError) throw err
        throw new ScrapingNetworkError(`${API_BASE}/manga/${mangaId}/feed`, err)
      }

      chapters.push(...data)
      if (data.length < CHAPTERS_PAGE_SIZE) break
      offset += CHAPTERS_PAGE_SIZE
    }

    return chapters
  }

  private async fetchAtHomeServer(chapterId: string): Promise<MangaDexAtHomeResponse> {
    try {
      const res = await this.rateLimiter.schedule(() =>
        http.get<MangaDexAtHomeResponse>(`${API_BASE}/at-home/server/${chapterId}`),
      )
      return res.data
    } catch (err) {
      if (err instanceof ScrapingNetworkError) throw err
      throw new ScrapingNetworkError(`${API_BASE}/at-home/server/${chapterId}`, err)
    }
  }
}

function buildLanguageParams(language?: string): string {
  if (!language || language === 'all') return ''
  const lang = language.toLowerCase().trim()
  if (lang === 'pt-br' || lang === 'pt') {
    return '&availableTranslatedLanguage[]=pt-br&availableTranslatedLanguage[]=pt'
  }
  if (lang === 'es') {
    return '&availableTranslatedLanguage[]=es&availableTranslatedLanguage[]=es-la'
  }
  if (lang === 'zh') {
    return '&availableTranslatedLanguage[]=zh&availableTranslatedLanguage[]=zh-hk&availableTranslatedLanguage[]=zh-ro'
  }
  return `&availableTranslatedLanguage[]=${encodeURIComponent(lang)}`
}

function resolveSearchTitle(manga: MangaDexMangaData, requestedLanguage?: string): string {
  const title = manga.attributes?.title ?? {}
  const altTitles = manga.attributes?.altTitles ?? []
  const lang = requestedLanguage?.toLowerCase().trim()

  const findAlt = (targetLang: string) => {
    for (const alt of altTitles) {
      if (alt[targetLang]) return alt[targetLang]
    }
    return undefined
  }

  if (lang && lang !== 'all') {
    if (lang === 'pt-br' || lang === 'pt') {
      const match = title['pt-br'] ?? title.pt ?? findAlt('pt-br') ?? findAlt('pt')
      if (match) return match
    } else {
      const match = title[lang] ?? findAlt(lang)
      if (match) return match
      return (
        title.en ??
        findAlt('en') ??
        title['ja-ro'] ??
        Object.values(title)[0] ??
        'Título desconhecido'
      )
    }
  }

  return (
    title['pt-br'] ??
    title.pt ??
    findAlt('pt-br') ??
    findAlt('pt') ??
    title.en ??
    findAlt('en') ??
    title['ja-ro'] ??
    Object.values(title)[0] ??
    'Título desconhecido'
  )
}

function resolveSearchCover(manga: MangaDexMangaData): string | null {
  const coverRel = manga.relationships?.find((r) => r.type === 'cover_art')
  const fileName = coverRel?.attributes?.fileName
  if (!fileName) return null
  return `${UPLOADS_BASE}/covers/${manga.id}/${fileName}`
}

function resolveSearchAuthor(manga: MangaDexMangaData): string | null {
  const authorRel = manga.relationships?.find((r) => r.type === 'author')
  return authorRel?.attributes?.name ?? null
}

/** Deriva o tipo de obra a partir do idioma original (MangaDex não expõe campo direto). */
function resolveSearchWorkType(originalLanguage: string | null | undefined): string | null {
  const lang = originalLanguage?.toLowerCase()
  if (lang === 'ja') return 'manga'
  if (lang === 'ko') return 'manhwa'
  if (lang?.startsWith('zh')) return 'manhua'
  return null
}

function resolveSearchGenres(manga: MangaDexMangaData): string[] | null {
  const genres = (manga.attributes?.tags ?? [])
    .map((t) => t.attributes?.name?.en || Object.values(t.attributes?.name || {})[0])
    .filter((g): g is string => Boolean(g))
  return genres.length > 0 ? genres : null
}
