import type {
  SourceInspectResponse,
  Chapter,
  Cover,
  MangaMetadata,
  SourceInfo,
} from '../../types/source.types'
import type { ProviderInfo } from '../../types/provider.types'
import {
  createSourceId,
  createChapterId,
  createCoverId,
} from '../../../../shared/utils/id-generator'
import type { CheerioAPI } from 'cheerio'

export const MANGAREAD_BASE_URL = 'https://www.mangaread.org'
const PROVIDER_SLUG = 'mangaread'

export const PROVIDER_INFO: ProviderInfo = {
  slug: PROVIDER_SLUG,
  name: 'MangaRead',
  engine: 'cheerio',
}

export function parseMangaReadSearchResult(
  $: CheerioAPI,
  base: string = MANGAREAD_BASE_URL,
): Array<{ title: string; url: string; coverUrl: string | null; author: string | null }> {
  const results: Array<{ title: string; url: string; coverUrl: string | null; author: string | null }> = []
  const seen = new Set<string>()

  $('.row.c-tabs-item__content, .c-tabs-item__content').each((_, el) => {
    const $el = $(el)
    const titleA = $el.find('.post-title h3 a, .post-title a').first()
    const title = titleA.text().trim()
    const href = titleA.attr('href')
    if (!title || !href) return

    const url = href.startsWith('http') ? href : `${base}${href}`
    if (seen.has(url)) return
    seen.add(url)

    const img = $el.find('.tab-thumb img').first()
    const coverUrl = img.attr('data-src') || img.attr('src') || null
    const author = $el.find('.mg_author .summary-content').text().trim() || null

    results.push({
      title,
      url,
      coverUrl,
      author,
    })
  })

  return results
}

export function mapMangaReadToInspectResponse(
  $: CheerioAPI,
  canonicalUrl: string,
): SourceInspectResponse {
  const sourceId = createSourceId(PROVIDER_SLUG, canonicalUrl)
  const metadata = parseMetadata($)
  const covers = parseCovers($, metadata.title)
  const chapters = parseChapters($)
  const source: SourceInfo = { url: canonicalUrl, language: 'en' }

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

function parseMetadata($: CheerioAPI): MangaMetadata {
  const title = $('.post-title h1').text().trim() || $('h1').first().text().trim() || 'Unknown Title'
  const description = $('.description-summary .summary__content').text().trim() || null
  const author = $('.author-content a').first().text().trim() || null

  const genres: string[] = []
  $('.genres-content a').each((_, el) => {
    const g = $(el).text().trim()
    if (g && !genres.includes(g)) genres.push(g)
  })

  let status = 'unknown'
  const rawStatus = $('.post-status .summary-content').first().text().toLowerCase()
  if (rawStatus.includes('ongoing')) status = 'ongoing'
  else if (rawStatus.includes('completed')) status = 'completed'
  else if (rawStatus.includes('on hiatus') || rawStatus.includes('hiatus')) status = 'hiatus'
  else if (rawStatus.includes('cancelled') || rawStatus.includes('discontinued')) status = 'cancelled'

  return {
    title,
    author,
    description,
    status,
    genres,
  }
}

function parseCovers($: CheerioAPI, title: string): Cover[] {
  const img = $('.summary_image img').first()
  const coverUrl = img.attr('data-src') || img.attr('src')
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

function parseChapters($: CheerioAPI): Chapter[] {
  const chapters: Chapter[] = []
  const seen = new Set<string>()

  $('li.wp-manga-chapter a').each((_, el) => {
    const href = $(el).attr('href')
    if (!href) return

    const rawTitle = $(el).text().trim()
    if (seen.has(href)) return
    seen.add(href)

    // Extrai número do capítulo da URL: .../chapter-1/ ou .../chapter-1-5/
    const match = href.match(/chapter-(\d+(?:[-._]\d+)?)/i) || rawTitle.match(/chapter\s+(\d+(?:\.\d+)?)/i)
    const number = match ? match[1].replace(/[-_]/g, '.') : '0'

    chapters.push({
      id: createChapterId(number),
      number,
      title: rawTitle || `Chapter ${number}`,
      url: href,
      pages: null,
      volume: null,
      isDownloaded: false,
      isRead: false,
    })
  })

  // Ordena crescente
  chapters.sort((a, b) => parseFloat(a.number) - parseFloat(b.number))
  return chapters
}

export function parseMangaReadChapterImages($: CheerioAPI): string[] {
  const pages: string[] = []
  const seen = new Set<string>()

  $('.reading-content img').each((_, el) => {
    const src = $(el).attr('data-src')?.trim() || $(el).attr('src')?.trim()
    if (!src) return
    if (seen.has(src)) return
    seen.add(src)
    pages.push(src)
  })

  return pages
}
