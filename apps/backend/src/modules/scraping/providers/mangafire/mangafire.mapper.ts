import type {
  MangaFireSearchResponse,
  MangaFireTitleDetail,
  MangaFireChapterItem,
  MangaFireChapterPagesResponse,
} from './mangafire.types'
import type {
  ProviderSearchResult,
  ProviderInfo,
} from '../../types/provider.types'
import type {
  SourceInspectResponse,
  Chapter,
  Cover,
} from '../../types/source.types'
import { createCoverId, createChapterId, createSourceId } from '../../../../shared/utils/id-generator'

/**
 * Extracts the MangaFire manga HID from a URL or raw ID.
 * Examples:
 * - https://mangafire.to/title/dkw-one-piece -> "dkw"
 * - https://mangafire.to/title/dkw -> "dkw"
 * - https://mangafire.to/manga/one-piece.dkw -> "dkw"
 * - https://mangafire.to/manga/dkw -> "dkw"
 * - "dkw" -> "dkw"
 */
export function extractMangaId(url: string): string {
  if (!url) return ''

  const trimmed = url.trim()

  // Match /title/([a-z0-9]+)(?:-[^/?#]+)?
  const titleMatch = trimmed.match(/\/title\/([a-z0-9]+)(?:-[^/?#]+)?/i)
  if (titleMatch?.[1]) {
    return titleMatch[1].toLowerCase()
  }

  // Match /manga/[^/?#]+\.([a-z0-9]+)
  const mangaDotMatch = trimmed.match(/\/manga\/[^/?#]+\.([a-z0-9]+)/i)
  if (mangaDotMatch?.[1]) {
    return mangaDotMatch[1].toLowerCase()
  }

  // Match /manga/([a-z0-9]+)
  const mangaMatch = trimmed.match(/\/manga\/([a-z0-9]+)(?:[/?#]|$)/i)
  if (mangaMatch?.[1]) {
    return mangaMatch[1].toLowerCase()
  }

  // If it's just an alphanumeric slug/hid without slashes
  if (/^[a-z0-9]+$/i.test(trimmed)) {
    return trimmed.toLowerCase()
  }

  // Fallback: extract last path segment before query/hash
  const cleanPath = trimmed.split(/[?#]/)[0].replace(/\/+$/, '')
  const lastPart = cleanPath.split('/').pop() || ''
  const subMatch = lastPart.match(/^([a-z0-9]+)/i)
  return subMatch?.[1] ? subMatch[1].toLowerCase() : lastPart.toLowerCase()
}

/**
 * Extracts the chapter ID from a MangaFire chapter URL.
 * Examples:
 * - https://mangafire.to/title/dkw-one-piece/chapter/9455278 -> "9455278"
 * - https://mangafire.to/read/one-piece.dkw/en/chapter-9455278 -> "9455278"
 * - "9455278" -> "9455278"
 */
export function extractChapterId(chapterUrl: string): string {
  if (!chapterUrl) return ''
  const trimmed = chapterUrl.trim()

  const match = trimmed.match(/(?:chapter[/-]|chapters\/)(\d+)/i)
  if (match?.[1]) {
    return match[1]
  }

  const cleanPath = trimmed.split(/[?#]/)[0].replace(/\/+$/, '')
  const lastPart = cleanPath.split('/').pop() || ''
  if (/^\d+$/.test(lastPart)) {
    return lastPart
  }

  return lastPart
}

/**
 * Normalizes MangaFire status into standard status string.
 */
export function normalizeStatus(rawStatus?: string | null): string {
  if (!rawStatus) return 'unknown'
  const s = rawStatus.toLowerCase().trim()

  if (s.includes('releasing') || s.includes('ongoing') || s.includes('publishing')) {
    return 'ongoing'
  }
  if (s.includes('completed') || s.includes('finished') || s.includes('end')) {
    return 'completed'
  }
  if (s.includes('hiatus') || s.includes('on_hiatus')) {
    return 'hiatus'
  }
  if (s.includes('cancelled') || s.includes('canceled') || s.includes('discontinued')) {
    return 'cancelled'
  }

  return 'unknown'
}

/**
 * Normalizes genres array handling both string[] and { id, title/name }[] API formats.
 */
export function normalizeGenres(rawGenres?: any[] | null): string[] {
  if (!Array.isArray(rawGenres)) return []
  return rawGenres
    .map((g) => {
      if (typeof g === 'string') return g.trim()
      if (g && typeof g === 'object') {
        const title = g.title || g.name || g.slug || ''
        return String(title).trim()
      }
      return String(g).trim()
    })
    .filter((g) => g.length > 0)
}

/**
 * Strips HTML tags and unescapes entities for clean text descriptions.
 */
export function stripHtml(html?: string | null): string | null {
  if (!html) return null
  const text = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim()
  return text.length > 0 ? text : null
}

/**
 * Parses MangaFire search API response into unified ProviderSearchResult array.
 */
export function parseSearchResults(
  response: MangaFireSearchResponse,
  baseUrl = 'https://mangafire.to'
): ProviderSearchResult[] {
  if (!response || !Array.isArray(response.items)) {
    return []
  }

  return response.items.map((item) => {
    const slug = item.slug ? `-${item.slug}` : ''
    const itemUrl = `${baseUrl.replace(/\/+$/, '')}/title/${item.hid}${slug}`
    const coverUrl =
      item.poster?.large || item.poster?.medium || item.poster?.small || null
    const author =
      Array.isArray(item.authors) && item.authors.length > 0
        ? item.authors.join(', ')
        : item.author || null

    return {
      providerSlug: 'mangafire',
      title: item.title || item.hid,
      url: itemUrl,
      coverUrl,
      author,
      type: item.type || null,
      genres: normalizeGenres(item.genres),
    }
  })
}

/**
 * Maps a MangaFire API chapter item to Chapter.
 */
export function mapToChapter(
  item: MangaFireChapterItem,
  mangaHid: string,
  mangaSlug: string,
  baseUrl = 'https://mangafire.to'
): Chapter {
  const chapterNumberStr = String(item.number ?? '0')
  const slugPart = mangaSlug ? `-${mangaSlug}` : ''
  const chapterUrl = `${baseUrl.replace(/\/+$/, '')}/title/${mangaHid}${slugPart}/chapter/${item.id}`
  const rawTitle = item.name ? item.name.trim() : ''
  const title = rawTitle.length > 0 ? rawTitle : `Capítulo ${chapterNumberStr}`

  let volume: number | null = null
  if (item.volume !== undefined && item.volume !== null && item.volume !== '') {
    const v = Number(item.volume)
    if (!Number.isNaN(v)) volume = v
  }

  const chapterNumberNum = parseFloat(chapterNumberStr) || 0
  const chapterId = createChapterId(chapterNumberNum)

  return {
    id: chapterId,
    number: chapterNumberStr,
    title,
    url: chapterUrl,
    pages: null,
    volume,
    isDownloaded: false,
    isRead: false,
  }
}

/**
 * Maps MangaFire title details and full chapters list to SourceInspectResponse.
 */
export function mapToSourceInspectResponse(
  detail: MangaFireTitleDetail,
  rawChapters: MangaFireChapterItem[],
  url: string,
  baseUrl: string,
  providerInfo: ProviderInfo
): SourceInspectResponse {
  const mangaHid = detail.hid
  const mangaSlug = detail.slug || ''
  const coverUrl =
    detail.poster?.large || detail.poster?.medium || detail.poster?.small || null

  const covers: Cover[] = []
  if (coverUrl) {
    covers.push({
      id: createCoverId(1),
      type: 'original',
      label: 'Capa Principal',
      imageUrl: coverUrl,
    })
  }

  const mappedChapters = rawChapters.map((ch) =>
    mapToChapter(ch, mangaHid, mangaSlug, baseUrl)
  )

  // Sort chapters ascending by chapter number
  mappedChapters.sort((a, b) => {
    const na = parseFloat(a.number) || 0
    const nb = parseFloat(b.number) || 0
    return na - nb
  })

  const author =
    Array.isArray(detail.authors) && detail.authors.length > 0
      ? detail.authors.join(', ')
      : detail.author || null

  const description =
    stripHtml(detail.synopsisHtml) || stripHtml(detail.description) || null

  const sourceId = createSourceId('mangafire', url)

  return {
    sourceId,
    status: 'ready',
    provider: providerInfo,
    source: {
      url,
      language: 'en',
    },
    metadata: {
      title: detail.title,
      author,
      description,
      status: normalizeStatus(detail.status),
      genres: normalizeGenres(detail.genres),
    },
    chapters: mappedChapters,
    covers,
    statistics: {
      chapters: mappedChapters.length,
      covers: covers.length,
    },
  }
}

/**
 * Maps MangaFire chapter pages response to an array of image URLs.
 */
export function mapToPages(response: MangaFireChapterPagesResponse): string[] {
  if (!response) return []

  const pages = response.data?.pages || response.pages
  if (Array.isArray(pages) && pages.length > 0) {
    return pages
      .map((p) => p?.url)
      .filter((u): u is string => typeof u === 'string' && u.length > 0)
  }

  if (Array.isArray(response.images) && response.images.length > 0) {
    return response.images
      .map((img) => (typeof img === 'string' ? img : img?.url))
      .filter((u): u is string => typeof u === 'string' && u.length > 0)
  }

  return []
}
