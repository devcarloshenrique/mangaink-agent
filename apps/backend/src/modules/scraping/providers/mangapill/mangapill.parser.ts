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

export const MANGAPILL_BASE_URL = 'https://mangapill.com'
const PROVIDER_SLUG = 'mangapill'

export const PROVIDER_INFO: ProviderInfo = {
  slug: PROVIDER_SLUG,
  name: 'Mangapill',
  engine: 'cheerio',
}

export function parseMangapillSearchResult(
  $: CheerioAPI,
  base: string = MANGAPILL_BASE_URL,
): Array<{ title: string; url: string; coverUrl: string | null; author: string | null }> {
  const results: Array<{ title: string; url: string; coverUrl: string | null; author: string | null }> = []
  const seen = new Set<string>()

  $('a[href*="/manga/"]').each((_, el) => {
    const $el = $(el)
    const href = $el.attr('href')
    if (!href || !href.startsWith('/manga/')) return

    const title = $el.find('div.leading-tight, div.font-bold').text().trim() || $el.text().trim()
    if (!title || title.length < 2) return

    const url = href.startsWith('http') ? href : `${base}${href}`
    if (seen.has(url)) return
    seen.add(url)

    let img = $el.find('img').first()
    if (!img.length) {
      // No layout real do Mangapill, o <a> da imagem é irmão anterior dentro do container
      const container = $el.closest('div').parent()
      img = container.find('figure img, img').first()
    }
    const coverUrl = img.attr('data-src') || img.attr('src') || null

    results.push({
      title,
      url,
      coverUrl,
      author: null,
    })
  })

  return results
}

export function mapMangapillToInspectResponse(
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
  const title = $('h1').first().text().trim() || 'Unknown Title'
  const description = $('p.text-sm').text().trim() || null

  const genres: string[] = []
  $('a[href*="/genres/"]').each((_, el) => {
    const g = $(el).text().trim()
    if (g && !genres.includes(g)) genres.push(g)
  })

  let status = 'unknown'
  $('div.grid div').each((_, el) => {
    const text = $(el).text().toLowerCase()
    if (text.includes('status')) {
      if (text.includes('publishing') || text.includes('ongoing')) status = 'ongoing'
      else if (text.includes('finished') || text.includes('completed')) status = 'completed'
      else if (text.includes('on hiatus') || text.includes('hiatus')) status = 'hiatus'
      else if (text.includes('cancelled') || text.includes('discontinued')) status = 'cancelled'
    }
  })

  return {
    title,
    author: null,
    description,
    status,
    genres,
  }
}

function parseCovers($: CheerioAPI, title: string): Cover[] {
  const img = $('figure img, img[alt*="cover"], img[alt*="' + title + '"]').first()
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

  $('#chapters a[href*="/chapters/"], a[href*="/chapters/"]').each((_, el) => {
    const href = $(el).attr('href')
    if (!href || !href.includes('/chapters/')) return

    const rawTitle = $(el).text().trim()
    const url = href.startsWith('http') ? href : `${MANGAPILL_BASE_URL}${href}`
    if (seen.has(url)) return
    seen.add(url)

    // Extrai número do capítulo da URL: /chapters/5121-10020000/ori-no-naka-no-soloist-chapter-20
    const match = href.match(/chapter-(\d+(?:\.\d+)?)/i) || rawTitle.match(/chapter\s+(\d+(?:\.\d+)?)/i)
    const number = match ? match[1] : '0'

    chapters.push({
      id: createChapterId(number),
      number,
      title: rawTitle || `Chapter ${number}`,
      url,
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

export function parseMangapillChapterImages($: CheerioAPI): string[] {
  const pages: string[] = []
  const seen = new Set<string>()

  $('picture img, img[data-src], img.chapter-img, img').each((_, el) => {
    const src = $(el).attr('data-src') || $(el).attr('src')
    if (!src) return
    if (!src.includes('readdetectiveconan') && !src.includes('mangapill')) return
    if (seen.has(src)) return
    seen.add(src)
    pages.push(src)
  })

  return pages
}
