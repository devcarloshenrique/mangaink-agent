import type { CheerioAPI } from 'cheerio'
import type { Chapter, Cover, MangaMetadata, SourceInfo } from '../../types/source.types'
import type { ProviderInfo } from '../../types/provider.types'
import { createChapterId, createCoverId, createSourceId } from '../../../../shared/utils/id-generator'
import { MANGALIVRE_SELECTORS as SEL } from './mangalivre.selectors'

const PROVIDER_SLUG = 'mangalivre'
const PROVIDER_INFO: ProviderInfo = {
  slug: PROVIDER_SLUG,
  name: 'Manga Livre',
  engine: 'cheerio',
}

const STATUS_MAP: Record<string, string> = {
  'em andamento': 'ongoing',
  ongoing: 'ongoing',
  completo: 'completed',
  completed: 'completed',
  hiatus: 'hiatus',
  dropado: 'dropped',
  dropped: 'dropped',
}

function absoluteUrl(href: string | undefined, base: string): string | undefined {
  if (!href) return undefined
  try {
    return new URL(href, base).href
  } catch {
    return undefined
  }
}

function sanitize(text: string | undefined): string | undefined {
  if (!text) return undefined
  const cleaned = text.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
  return cleaned || undefined
}

function detectStatus($: CheerioAPI): string | null {
  const bodyText = $('body').text().toLowerCase()
  for (const [keyword, value] of Object.entries(STATUS_MAP)) {
    if (bodyText.includes(keyword)) return value
  }
  return null
}

function getMangaSlug(canonicalUrl: string): string {
  try {
    return new URL(canonicalUrl).pathname.match(/\/manga\/([^/]+)/)?.[1] ?? ''
  } catch {
    return ''
  }
}

function extractChapterNumber(
  href: string,
  base: string,
  mangaSlug: string,
): string | null {
  const url = absoluteUrl(href, base)
  if (!url) return null

  try {
    const { pathname } = new URL(url)
    const match = pathname.match(/^\/manga\/([^/]+)\/capitulo-(\d+(?:[._-]\d+)?)/)
    if (!match || match[1] !== mangaSlug) return null
    return match[2].replace(/[._-]/, '.')
  } catch {
    return null
  }
}

export function parseMetadata($: CheerioAPI, canonicalUrl: string): MangaMetadata {
  const rawTitle =
    $(SEL.title).first().text().trim() ||
    $(SEL.ogTitle).attr('content')?.trim() ||
    'Manga Desconhecido'

  const title = sanitize(rawTitle) ?? 'Manga Desconhecido'

  const author = sanitize($(SEL.author).first().text()) ?? null

  const rawDescription =
    $(SEL.description).first().text() || $(SEL.ogDescription).attr('content')
  const description = sanitize(rawDescription) ?? null

  const status = detectStatus($)

  const genres: string[] = []
  const scopedGenres = $(SEL.genres)
  const genreSel = scopedGenres.length > 0 ? scopedGenres : $(SEL.fallbackGenres)
  genreSel.each((_, el) => {
    const genre = $(el).text().trim()
    if (genre && !genres.includes(genre)) genres.push(genre)
  })

  return { title, author, description, status, genres }
}

export function parseCover($: CheerioAPI, base: string): Cover[] {
  const imgEl = $(SEL.cover).first()
  const src =
    imgEl.attr('src') ||
    imgEl.attr('data-src') ||
    imgEl.attr('data-lazy-src') ||
    $(SEL.ogImage).attr('content')

  const imageUrl = absoluteUrl(src, base)
  if (!imageUrl) return []

  return [
    {
      id: createCoverId(1),
      type: 'original',
      label: 'Original',
      imageUrl,
    },
  ]
}

export function parseChapters($: CheerioAPI, base: string, canonicalUrl: string): Chapter[] {
  const mangaSlug = getMangaSlug(canonicalUrl)
  const seen = new Set<string>()
  const chapters: Chapter[] = []

  $(SEL.chapters).each((_, el) => {
    const href = $(el).attr('href')
    const chapterNumber = href ? extractChapterNumber(href, base, mangaSlug) : null
    if (!href || !chapterNumber || seen.has(chapterNumber)) return

    seen.add(chapterNumber)

    const rawTitle = $(el).text().trim()
    const title =
      rawTitle && rawTitle.length <= 80
        ? rawTitle
        : `Capítulo ${chapterNumber}`

    chapters.push({
      id: createChapterId(chapterNumber),
      number: chapterNumber,
      title,
      url: absoluteUrl(href, base) ?? href,
      pages: null,
      volume: null,
    })
  })

  // Ordena crescente por número (suporte a decimais)
  chapters.sort((a, b) => parseFloat(a.number) - parseFloat(b.number))

  return chapters
}

export function parseSourceInfo(canonicalUrl: string): SourceInfo {
  return {
    url: canonicalUrl,
    language: null,
  }
}

export function buildProviderInfo(): ProviderInfo {
  return PROVIDER_INFO
}
