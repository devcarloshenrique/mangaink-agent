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
import type { TaiyoMeiliHit, TaiyoChapterSummary, TaiyoChapterDetail } from './taiyo.types'

export const TAIYO_BASE_URL = 'https://taiyo.moe'
export const TAIYO_CDN_URL = 'https://cdn.taiyo.moe'
export const TAIYO_MEILI_URL = 'https://meilisearch.taiyo.moe'
export const TAIYO_MEILI_KEY = '48aa86f73de09a7705a2938a1a35e5a12cff6519695fcad395161315182286e5'

const PROVIDER_SLUG = 'taiyo'

export const PROVIDER_INFO: ProviderInfo = {
  slug: PROVIDER_SLUG,
  name: 'Taiyo',
  engine: 'api',
}

export function extractMediaTitle(
  titles: { title: string; language?: string; isMainTitle?: boolean; priority?: number }[] = [],
): string {
  if (!titles.length) return 'Manga Desconhecido'
  const pt = titles.find((t) => {
    const lang = t.language?.toUpperCase()
    return lang === 'PT-BR' || lang === 'PT_BR' || lang === 'PT'
  })
  if (pt?.title) return pt.title
  const main = titles.find((t) => t.isMainTitle)
  if (main?.title) return main.title
  const en = titles.find((t) => t.language?.toUpperCase() === 'EN')
  if (en?.title) return en.title
  return titles[0].title || 'Manga Desconhecido'
}

export function buildCoverUrl(mediaId: string, coverId?: string | null): string | null {
  if (!coverId) return null
  return `${TAIYO_CDN_URL}/medias/${mediaId}/covers/${coverId}.jpg`
}

export function parseTaiyoSearchResult(hit: TaiyoMeiliHit): {
  title: string
  url: string
  coverUrl: string | null
  author: string | null
} {
  const title = extractMediaTitle(hit.titles)
  const url = `${TAIYO_BASE_URL}/media/${hit.id}`
  const coverUrl = buildCoverUrl(hit.id, hit.mainCoverId)

  return {
    title,
    url,
    coverUrl,
    author: null,
  }
}

export function mapTaiyoToInspectResponse(
  mediaData: any,
  chaptersData: TaiyoChapterSummary[],
  canonicalUrl: string,
): SourceInspectResponse {
  const mediaId = mediaData.id
  const sourceId = createSourceId(PROVIDER_SLUG, canonicalUrl)
  const metadata = mapMetadata(mediaData)
  const covers = mapCovers(mediaData)
  const chapters = mapChapters(chaptersData)
  const source: SourceInfo = { url: canonicalUrl, language: 'pt-BR' }

  return {
    sourceId,
    status: 'ready',
    provider: PROVIDER_INFO,
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

function mapMetadata(media: any): MangaMetadata {
  const title = extractMediaTitle(media.titles || (media.mainTitle ? [{ title: media.mainTitle }] : []))

  let status = 'unknown'
  if (media.status === 'RELEASING') status = 'ongoing'
  else if (media.status === 'COMPLETED') status = 'completed'
  else if (media.status === 'HIATUS') status = 'hiatus'
  else if (media.status === 'CANCELLED') status = 'cancelled'

  return {
    title,
    author: null,
    description: media.synopsis || null,
    status,
    genres: media.genres || [],
  }
}

function mapCovers(media: any): Cover[] {
  const coverUrl = buildCoverUrl(media.id, media.coverId || media.mainCoverId)
  if (!coverUrl) return []
  return [
    {
      id: createCoverId(1),
      type: 'original',
      label: 'Original',
      imageUrl: coverUrl,
    },
  ]
}

function mapChapters(chapters: TaiyoChapterSummary[]): Chapter[] {
  // Deduplica por número mantendo PT-BR ou o primeiro encontrado
  const byNumber = new Map<string, TaiyoChapterSummary>()

  for (const ch of chapters || []) {
    const numStr = String(ch.number)
    const existing = byNumber.get(numStr)
    if (!existing) {
      byNumber.set(numStr, ch)
    } else {
      const isExistingPt = existing.language?.toUpperCase().includes('PT')
      const isNewPt = ch.language?.toUpperCase().includes('PT')
      if (!isExistingPt && isNewPt) {
        byNumber.set(numStr, ch)
      }
    }
  }

  const mapped: Chapter[] = Array.from(byNumber.values()).map((ch) => {
    const numStr = String(ch.number)
    return {
      id: createChapterId(numStr),
      number: numStr,
      title: ch.title ? `Capítulo ${numStr} - ${ch.title}` : `Capítulo ${numStr}`,
      url: `${TAIYO_BASE_URL}/chapter/${ch.id}`,
      pages: null,
      volume: typeof ch.volume === 'number' ? ch.volume : null,
      isDownloaded: false,
      isRead: false,
    }
  })

  // Ordena crescente por número
  mapped.sort((a, b) => parseFloat(a.number) - parseFloat(b.number))
  return mapped
}

export function parseTaiyoPages(detail: TaiyoChapterDetail, mediaId: string): string[] {
  const pages = detail.pages || []
  const sorted = [...pages].sort((a, b) => (a.pageNumber ?? 0) - (b.pageNumber ?? 0))
  return sorted.map((p) => {
    const ext = p.extension || 'jpg'
    return `${TAIYO_CDN_URL}/medias/${mediaId}/chapters/${detail.id}/${p.id}.${ext}`
  })
}
