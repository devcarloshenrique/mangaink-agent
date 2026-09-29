import * as cheerio from 'cheerio'
import {
  ProviderInfo,
  ProviderSearchResult,
} from '../../types/provider.types'
import {
  Chapter,
  Cover,
  SourceInspectResponse,
} from '../../types/source.types'
import {
  createChapterId,
  createCoverId,
  createSourceId,
} from '../../../../shared/utils/id-generator'
import {
  FlameComicsBrowsePageProps,
  FlameComicsChapterPageProps,
  FlameComicsNextData,
  FlameComicsSeriesApiItem,
  FlameComicsSeriesPageProps,
} from './flamecomics.types'

const BASE_URL = 'https://flamecomics.xyz'
const CDN_URL = 'https://cdn.flamecomics.xyz'

/**
 * Normaliza o status da obra retornado pelo Flame Comics para string padronizada.
 */
export function normalizeStatus(statusRaw?: string | null): string {
  if (!statusRaw) return 'unknown'
  const s = statusRaw.toLowerCase().trim()

  if (s.includes('ongoing') || s.includes('lancando') || s.includes('em lançamento')) {
    return 'ongoing'
  }
  if (s.includes('completed') || s.includes('completo') || s.includes('finalizado')) {
    return 'completed'
  }
  if (s.includes('hiatus') || s.includes('hiato') || s.includes('pausado')) {
    return 'hiatus'
  }
  if (s.includes('cancelled') || s.includes('cancelado') || s.includes('dropped')) {
    return 'cancelled'
  }
  return 'unknown'
}

/**
 * Extrai o número do capítulo a partir de strings como "311.00", "0.00", "Chapter 12.5", etc.
 */
export function extractChapterNumber(raw: string | number | null | undefined): string {
  if (raw === null || raw === undefined) return '0'
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? String(raw) : '0'
  }

  const trimmed = raw.trim()
  const directFloat = parseFloat(trimmed)
  if (!isNaN(directFloat) && /^\d+(\.\d+)?$/.test(trimmed)) {
    return String(directFloat)
  }

  const chapterMatch = trimmed.match(/(?:chapter|ch\.?|cap[íi]tulo|cap\.?)\s*(\d+(?:\.\d+)?)/i)
  if (chapterMatch) {
    return String(parseFloat(chapterMatch[1]))
  }

  const numberMatch = trimmed.match(/(\d+(?:\.\d+)?)/)
  if (numberMatch) {
    return String(parseFloat(numberMatch[1]))
  }

  return trimmed || '0'
}

/**
 * Extrai o número do volume se presente no título do capítulo.
 */
export function extractVolume(title?: string | null): number | null {
  if (!title) return null
  const match = title.match(/[Vv]ol(?:ume)?\.?\s*(\d+)/i)
  return match ? parseInt(match[1], 10) : null
}

/**
 * Constrói a URL completa para capa da obra.
 */
export function buildCoverUrl(seriesId: number | string, coverFile?: string | null): string | null {
  if (!coverFile) return null
  if (coverFile.startsWith('http://') || coverFile.startsWith('https://')) {
    return coverFile
  }
  const cleanCover = coverFile.replace(/^\/+/, '')
  return `${CDN_URL}/uploads/images/series/${seriesId}/${cleanCover}`
}

/**
 * Extrai o payload de dados __NEXT_DATA__ embutido em páginas geradas pelo Next.js.
 */
export function extractNextData<T = Record<string, unknown>>(html: string): FlameComicsNextData<T> | null {
  try {
    const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/)
    if (match && match[1]) {
      return JSON.parse(match[1]) as FlameComicsNextData<T>
    }
  } catch {
    // Falha silenciosa de JSON parse, fallback para Cheerio
  }
  return null
}

/**
 * Mapeia a lista de obras retornada pela API interna (/api/series) em resultados de busca.
 */
export function parseApiSeriesResults(
  items: FlameComicsSeriesApiItem[],
  query: string | undefined,
  providerInfo: ProviderInfo,
  limit?: number,
): ProviderSearchResult[] {
  const q = query?.trim().toLowerCase()
  let filtered = items

  if (q) {
    filtered = items.filter((item) => item.label && item.label.toLowerCase().includes(q))
  }

  if (typeof limit === 'number' && limit > 0) {
    filtered = filtered.slice(0, limit)
  }

  return filtered.map((item) => {
    const url = `${BASE_URL}/series/${item.id}`
    const coverUrl = buildCoverUrl(item.id, item.image)

    return {
      providerSlug: providerInfo.slug,
      title: item.label || `Series #${item.id}`,
      url,
      coverUrl,
      author: null,
      type: null,
      genres: null,
    }
  })
}

/**
 * Mapeia o HTML da página /browse do Flame Comics em resultados de busca (fallback).
 */
export function parseBrowseHtml(
  html: string,
  query: string | undefined,
  providerInfo: ProviderInfo,
  limit?: number,
): ProviderSearchResult[] {
  const nextData = extractNextData<FlameComicsBrowsePageProps>(html)
  const seriesList = nextData?.props?.pageProps?.series

  if (Array.isArray(seriesList) && seriesList.length > 0) {
    const q = query?.trim().toLowerCase()
    let filtered = seriesList

    if (q) {
      filtered = seriesList.filter((s) => {
        const title = s.title || s.label || ''
        return title.toLowerCase().includes(q)
      })
    }

    if (typeof limit === 'number' && limit > 0) {
      filtered = filtered.slice(0, limit)
    }

    return filtered.map((s) => {
      const id = s.series_id || s.id || 0
      const title = s.title || s.label || `Series #${id}`
      const url = `${BASE_URL}/series/${id}`
      const coverUrl = buildCoverUrl(id, s.cover || s.image)
      const author = Array.isArray(s.author) ? s.author.join(', ') : (s.author || null)
      const genres = Array.isArray(s.categories) ? s.categories : null

      return {
        providerSlug: providerInfo.slug,
        title,
        url,
        coverUrl,
        author,
        type: s.type || null,
        genres,
      }
    })
  }

  // Fallback para parsing via Cheerio se __NEXT_DATA__ não estiver presente
  const $ = cheerio.load(html)
  const results: ProviderSearchResult[] = []
  const seenUrls = new Set<string>()
  const q = query?.trim().toLowerCase()

  $('a[href*="/series/"]').each((_, el) => {
    const href = $(el).attr('href')
    if (!href) return

    const match = href.match(/\/series\/(\d+)/)
    if (!match) return

    const id = match[1]
    const fullUrl = href.startsWith('http') ? href : `${BASE_URL}/series/${id}`
    if (seenUrls.has(fullUrl)) return

    const title = $(el).find('h2, h3, h4, p, span').first().text().trim() || $(el).text().trim()
    if (!title || (q && !title.toLowerCase().includes(q))) return

    const imgEl = $(el).find('img').first()
    const imgSrc = imgEl.attr('src') || imgEl.attr('data-src') || null

    seenUrls.add(fullUrl)
    results.push({
      providerSlug: providerInfo.slug,
      title,
      url: fullUrl,
      coverUrl: imgSrc,
      author: null,
      type: null,
      genres: null,
    })

    if (typeof limit === 'number' && limit > 0 && results.length >= limit) {
      return false
    }
  })

  return results
}

/**
 * Mapeia a página de detalhes da obra do Flame Comics no modelo SourceInspectResponse.
 * Garante a coleta de 100% dos capítulos disponíveis da obra.
 */
export function mapSeriesDetails(
  html: string,
  sourceUrl: string,
  providerInfo: ProviderInfo,
): SourceInspectResponse {
  const sourceId = createSourceId(providerInfo.slug, sourceUrl)
  const nextData = extractNextData<FlameComicsSeriesPageProps>(html)
  const series = nextData?.props?.pageProps?.series
  const rawChaptersList = nextData?.props?.pageProps?.chapters

  if (series) {
    const seriesId = series.series_id || 0
    const title = series.title || 'Sem título'

    let description: string | undefined
    if (series.description) {
      description = cheerio.load(series.description).text().trim() || series.description.trim()
    }

    const status = normalizeStatus(series.status)
    const authors = Array.isArray(series.author)
      ? series.author
      : (series.author ? [series.author] : [])
    const genres = Array.isArray(series.tags)
      ? series.tags
      : (Array.isArray(series.categories) ? series.categories : [])

    const coverUrl = buildCoverUrl(seriesId, series.cover || series.image || series.thumbnail)

    const rawChapters: Array<{
      chapterUrl: string
      chapterNumber: string
      title: string
      volume: number | null
      releasedAt?: string
    }> = []

    const chapterItems = Array.isArray(rawChaptersList) ? rawChaptersList : []
    for (const ch of chapterItems) {
      const chapterNumber = extractChapterNumber(ch.chapter)
      const chUrl = `${BASE_URL}/series/${ch.series_id || seriesId}/${ch.token}`
      const chTitle = ch.title ? ch.title.trim() : `Capítulo ${chapterNumber}`
      const volume = extractVolume(ch.title)
      const releasedAt = ch.release_date
        ? new Date(ch.release_date * 1000).toISOString()
        : undefined

      rawChapters.push({
        chapterUrl: chUrl,
        chapterNumber,
        title: chTitle,
        volume,
        releasedAt,
      })
    }

    // Ordena capítulos por número crescente (0, 1, 2, ..., 311)
    rawChapters.sort((a, b) => {
      const numA = parseFloat(a.chapterNumber)
      const numB = parseFloat(b.chapterNumber)
      if (!isNaN(numA) && !isNaN(numB)) {
        return numA - numB
      }
      return a.chapterNumber.localeCompare(b.chapterNumber, undefined, { numeric: true })
    })

    const chapters: Chapter[] = rawChapters.map((c) => ({
      id: createChapterId(c.chapterNumber),
      number: c.chapterNumber,
      title: c.title,
      url: c.chapterUrl,
      pages: null,
      volume: c.volume,
      isDownloaded: false,
      isRead: false,
      ...(c.releasedAt ? { releasedAt: c.releasedAt } : {}),
    }))

    const covers: Cover[] = coverUrl
      ? [
          {
            id: createCoverId(1),
            type: 'original',
            label: 'Capa Principal',
            imageUrl: coverUrl,
          },
        ]
      : []

    return {
      sourceId,
      status: 'ready',
      provider: providerInfo,
      source: {
        url: sourceUrl,
        language: 'en',
      },
      metadata: {
        title,
        author: authors.length > 0 ? authors.join(', ') : null,
        description: description || null,
        status,
        genres,
      },
      chapters,
      covers,
      statistics: {
        chapters: chapters.length,
        covers: covers.length,
      },
    }
  }

  // Fallback via Cheerio se a página não contiver __NEXT_DATA__
  const $ = cheerio.load(html)
  const title =
    $('h1').first().text().trim() ||
    $('meta[property="og:title"]').attr('content')?.trim() ||
    'Sem título'

  const coverUrlRaw =
    $('meta[property="og:image"]').attr('content') ||
    $('img[src*="/uploads/images/series/"]').first().attr('src') ||
    null

  const coverUrl = coverUrlRaw ? coverUrlRaw.split('?')[0].trim() : null
  const description =
    $('meta[name="description"]').attr('content')?.trim() ||
    $('p[class*="Text-root"]').first().text().trim() ||
    undefined

  const rawFallbackChapters: Array<{
    chapterUrl: string
    chapterNumber: string
    title: string
    volume: number | null
  }> = []

  const seenChapterUrls = new Set<string>()

  $('a[href*="/series/"]').each((_, el) => {
    const href = $(el).attr('href')
    if (!href) return

    // Capítulos têm o formato /series/{seriesId}/{token}
    const match = href.match(/\/series\/\d+\/([a-zA-Z0-9_-]+)/)
    if (!match) return

    const fullUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`
    if (seenChapterUrls.has(fullUrl)) return
    seenChapterUrls.add(fullUrl)

    const rawText = $(el).text().trim()
    const chapterNumber = extractChapterNumber(rawText)
    const chapTitle = rawText || `Capítulo ${chapterNumber}`
    const volume = extractVolume(rawText)

    rawFallbackChapters.push({
      chapterUrl: fullUrl,
      chapterNumber,
      title: chapTitle,
      volume,
    })
  })

  rawFallbackChapters.sort((a, b) => {
    const numA = parseFloat(a.chapterNumber)
    const numB = parseFloat(b.chapterNumber)
    if (!isNaN(numA) && !isNaN(numB)) {
      return numA - numB
    }
    return a.chapterNumber.localeCompare(b.chapterNumber, undefined, { numeric: true })
  })

  const chapters: Chapter[] = rawFallbackChapters.map((c) => ({
    id: createChapterId(c.chapterNumber),
    number: c.chapterNumber,
    title: c.title,
    url: c.chapterUrl,
    pages: null,
    volume: c.volume,
    isDownloaded: false,
    isRead: false,
  }))

  const covers: Cover[] = coverUrl
    ? [
        {
          id: createCoverId(1),
          type: 'original',
          label: 'Capa Principal',
          imageUrl: coverUrl,
        },
      ]
    : []

  return {
    sourceId,
    status: 'ready',
    provider: providerInfo,
    source: {
      url: sourceUrl,
      language: 'en',
    },
    metadata: {
      title,
      author: null,
      description: description || null,
      status: 'unknown',
      genres: [],
    },
    chapters,
    covers,
    statistics: {
      chapters: chapters.length,
      covers: covers.length,
    },
  }
}

/**
 * Extrai as URLs das imagens de um capítulo do Flame Comics.
 * Prioriza __NEXT_DATA__ e faz fallback para Cheerio.
 */
export function parseChapterImages(html: string): string[] {
  // 1. Tenta extrair a partir de __NEXT_DATA__
  const nextData = extractNextData<FlameComicsChapterPageProps>(html)
  const chapterData = nextData?.props?.pageProps?.chapter

  if (chapterData && chapterData.images) {
    const seriesId = chapterData.series_id
    const token = chapterData.token
    const imagesMap = chapterData.images

    const sortedEntries = Object.entries(imagesMap).sort(([a], [b]) => {
      const idxA = parseInt(a, 10)
      const idxB = parseInt(b, 10)
      if (!isNaN(idxA) && !isNaN(idxB)) {
        return idxA - idxB
      }
      return a.localeCompare(b, undefined, { numeric: true })
    })

    const imageUrls: string[] = []
    for (const [, img] of sortedEntries) {
      if (img?.name) {
        imageUrls.push(`${CDN_URL}/uploads/images/series/${seriesId}/${token}/${img.name}`)
      }
    }

    if (imageUrls.length > 0) {
      return imageUrls
    }
  }

  // 2. Fallback para parsing via Cheerio
  const $ = cheerio.load(html)
  const images: string[] = []
  const seenUrls = new Set<string>()

  $('img').each((_, el) => {
    const src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-lazy-src')
    if (!src) return

    const cleaned = src.split('?')[0].trim()
    if (
      cleaned.includes('/uploads/images/series/') &&
      !cleaned.includes('thumbnail') &&
      !seenUrls.has(cleaned)
    ) {
      seenUrls.add(cleaned)
      images.push(cleaned)
    }
  })

  return images
}
