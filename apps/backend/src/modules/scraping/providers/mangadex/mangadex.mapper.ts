import {
  createSourceId,
  createChapterId,
  createCoverId,
} from '../../../../shared/utils/id-generator'
import type {
  SourceInspectResponse,
  Chapter,
  Cover,
  MangaMetadata,
  SourceInfo,
} from '../../types/source.types'
import type { ProviderInfo } from '../../types/provider.types'
import type {
  MangaDexMangaData,
  MangaDexChapterData,
  MangaDexAtHomeResponse,
} from './mangadex.types'

export const PROVIDER_SLUG = 'mangadex'
export const BASE_URL = 'https://mangadex.org'
export const API_BASE = 'https://api.mangadex.org'
export const UPLOADS_BASE = 'https://uploads.mangadex.org'

const PROVIDER_INFO: ProviderInfo = {
  slug: PROVIDER_SLUG,
  name: 'MangaDex',
  engine: 'api',
}

const MANGA_URL_PATTERN =
  /mangadex\.org\/title\/([0-9a-fA-F-]{36})(?:\/([^\s/?#]+))?/

const CHAPTER_URL_PATTERN =
  /mangadex\.org\/chapter\/([0-9a-fA-F-]{36})/

export function extractMangaId(url: string): string | null {
  const match = url.match(MANGA_URL_PATTERN)
  if (match?.[1]) return match[1]
  // Fallback if URL is direct API or just UUID
  const uuidMatch = url.match(/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/)
  return uuidMatch?.[1] ?? null
}

export function extractChapterId(url: string): string | null {
  const match = url.match(CHAPTER_URL_PATTERN)
  if (match?.[1]) return match[1]
  const uuidMatch = url.match(/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/)
  return uuidMatch?.[1] ?? null
}

export function resolveStatus(status: string | null): string {
  const s = status?.toLowerCase() ?? ''
  if (s === 'ongoing') return 'ongoing'
  if (s === 'completed') return 'completed'
  if (s === 'hiatus') return 'hiatus'
  if (s === 'cancelled') return 'cancelled'
  return 'unknown'
}

export function normalizeChapterNumber(number: string | null): string {
  if (!number) return '0'
  const n = parseFloat(number)
  if (Number.isNaN(n)) return number
  return Number.isInteger(n) ? String(Math.trunc(n)) : String(n)
}

export function buildProviderInfo(): ProviderInfo {
  return PROVIDER_INFO
}

export function mapMangaToInspectResponse(
  manga: MangaDexMangaData,
  chapters: MangaDexChapterData[],
  canonicalUrl: string,
): SourceInspectResponse {
  const sourceId = createSourceId(PROVIDER_SLUG, canonicalUrl)
  const metadata = mapMetadata(manga)
  const covers = mapCovers(manga)
  const mappedChapters = mapChapters(chapters, manga.id)
  const source: SourceInfo = { url: canonicalUrl, language: 'pt-BR' }

  return {
    sourceId,
    status: 'ready',
    provider: PROVIDER_INFO,
    source,
    metadata,
    chapters: mappedChapters,
    covers,
    statistics: {
      chapters: mappedChapters.length,
      covers: covers.length,
    },
  }
}

function mapMetadata(manga: MangaDexMangaData): MangaMetadata {
  const titles = manga.attributes.title
  const mainTitle =
    titles['pt-br'] ||
    titles.pt ||
    titles.en ||
    titles['ja-ro'] ||
    Object.values(titles)[0] ||
    'Manga Desconhecido'

  // Descriptions in pt-br, pt or en
  const desc = manga.attributes.description
  const description =
    desc?.['pt-br'] ||
    desc?.pt ||
    desc?.en ||
    (desc ? Object.values(desc)[0] : null) ||
    null

  // Author relationship
  const authorRel = manga.relationships?.find(
    (r) => r.type === 'author' || r.type === 'artist',
  )
  const author = authorRel?.attributes?.name ?? null

  const genres = (manga.attributes.tags ?? [])
    .map((t) => t.attributes?.name?.en || Object.values(t.attributes?.name || {})[0])
    .filter((g): g is string => Boolean(g))

  return {
    title: mainTitle.trim(),
    author: author ? author.trim() : null,
    description: description ? description.trim() : null,
    status: resolveStatus(manga.attributes.status),
    genres,
  }
}

function mapCovers(manga: MangaDexMangaData): Cover[] {
  const coverRel = manga.relationships?.find((r) => r.type === 'cover_art')
  const fileName = coverRel?.attributes?.fileName
  if (!fileName) return []

  const imageUrl = `${UPLOADS_BASE}/covers/${manga.id}/${fileName}`
  return [
    {
      id: createCoverId(1),
      type: 'original',
      label: 'Original',
      imageUrl,
    },
  ]
}

function mapChapters(chapters: MangaDexChapterData[], mangaId: string): Chapter[] {
  // Filter out external URLs (e.g. MangaPlus links that can't be scraped directly)
  const internalChapters = chapters.filter((c) => !c.attributes.externalUrl)

  // Map to domain Chapter
  const mapped: Chapter[] = internalChapters.map((cap) => {
    const number = normalizeChapterNumber(cap.attributes.chapter)
    const title = cap.attributes.title
      ? `Capítulo ${number} - ${cap.attributes.title}`
      : `Capítulo ${number}`

    const parsedVolume = cap.attributes.volume ? parseFloat(cap.attributes.volume) : null
    const volume = parsedVolume !== null && !Number.isNaN(parsedVolume) ? parsedVolume : null

    return {
      id: createChapterId(number),
      number,
      title: title.trim(),
      url: `${BASE_URL}/chapter/${cap.id}`,
      pages: cap.attributes.pages || null,
      volume,
      isDownloaded: false,
      isRead: false,
    }
  })

  // Deduplicate by chapter number if multiple scanlations exist (keep first / best)
  const seenNumbers = new Set<string>()
  const uniqueMapped: Chapter[] = []
  for (const ch of mapped) {
    if (!seenNumbers.has(ch.number)) {
      seenNumbers.add(ch.number)
      uniqueMapped.push(ch)
    }
  }

  // Sort ascending by chapter number
  uniqueMapped.sort((a, b) => parseFloat(a.number) - parseFloat(b.number))
  return uniqueMapped
}

export function mapAtHomeToImageUrls(atHome: MangaDexAtHomeResponse): string[] {
  const { baseUrl, chapter } = atHome
  if (!baseUrl || !chapter?.hash || !Array.isArray(chapter.data)) {
    return []
  }

  return chapter.data.map(
    (fileName) => `${baseUrl}/data/${chapter.hash}/${fileName}`,
  )
}
