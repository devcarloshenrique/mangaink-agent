import * as cheerio from 'cheerio'
import type { SourceInspectResponse, Chapter, Cover } from '../../types/source.types'
import type { ProviderInfo, ProviderSearchResult } from '../../types/provider.types'
import { createSourceId, createChapterId, createCoverId } from '../../../../shared/utils/id-generator'

/**
 * Normaliza o status textual para o enum padronizado da aplicação.
 */
export function normalizeStatus(rawStatus?: string | null): 'ongoing' | 'completed' | 'hiatus' | 'cancelled' | 'unknown' {
  if (!rawStatus) return 'unknown'
  const s = rawStatus
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()

  if (
    s.includes('ongoing') ||
    s.includes('lancamento') ||
    s.includes('andamento') ||
    s.includes('ativo')
  ) {
    return 'ongoing'
  }
  if (
    s.includes('completed') ||
    s.includes('completo') ||
    s.includes('finalizado') ||
    s.includes('concluido')
  ) {
    return 'completed'
  }
  if (s.includes('hiatus') || s.includes('hiato')) {
    return 'hiatus'
  }
  if (s.includes('cancelled') || s.includes('cancelado') || s.includes('dropped')) {
    return 'cancelled'
  }
  return 'unknown'
}

/**
 * Converte URLs relativas em absolutas.
 */
export function toAbsoluteUrl(url: string | undefined | null, baseUrl: string): string | null {
  if (!url) return null
  const trimmed = url.trim()
  if (!trimmed || trimmed.startsWith('data:') || trimmed.startsWith('javascript:')) return null
  if (trimmed.startsWith('//')) return `https:${trimmed}`
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed
  try {
    return new URL(trimmed, baseUrl).toString()
  } catch {
    return trimmed
  }
}

/**
 * Extrai o número do capítulo a partir do href ou do texto.
 */
export function extractChapterNumber(hrefOrText: string): string {
  const matchHref = hrefOrText.match(/\/chapter\/([\d.]+)/i)
  if (matchHref) {
    return matchHref[1]
  }

  const matchText = hrefOrText.match(/(?:chapter|ch\.?|cap[íi]tulo|cap\.?)\s*([\d.]+)/i)
  if (matchText) {
    return matchText[1]
  }

  const matchNum = hrefOrText.match(/(\d+(?:\.\d+)?)/)
  if (matchNum) {
    return matchNum[1]
  }

  return '0'
}

/**
 * Faz o parse dos resultados de busca no HTML do Asura Scans (/comics?name=... ou /browse?search=...).
 */
export function parseSearchResults(html: string, baseUrl = 'https://asurascans.com'): ProviderSearchResult[] {
  const $ = cheerio.load(html)
  const results: ProviderSearchResult[] = []
  const seenUrls = new Set<string>()

  $('a[href*="/comics/"]').each((_, el) => {
    const rawUrl = $(el).attr('href')
    if (!rawUrl) return

    // O link de card no grid de quadrinhos deve ter uma imagem de capa
    const imgEl = $(el).find('img').first()
    if (imgEl.length === 0) return

    const url = toAbsoluteUrl(rawUrl, baseUrl)
    if (!url || seenUrls.has(url)) return
    seenUrls.add(url)

    const rawCover = imgEl.attr('src') || imgEl.attr('data-src')
    const coverUrl = toAbsoluteUrl(rawCover, baseUrl)

    const title =
      $(el).find('h3, h4, span.font-bold').first().text().trim() ||
      imgEl.attr('alt')?.trim() ||
      $(el).text().trim()

    if (!title) return

    results.push({
      providerSlug: 'asurascans',
      title,
      url,
      coverUrl,
      type: undefined,
    })
  })

  return results
}

/**
 * Mapeia os detalhes completos da obra e lista de capítulos a partir do HTML de detalhes do Asura Scans.
 */
export function mapComicDetails(
  html: string,
  sourceUrl: string,
  providerInfo: ProviderInfo,
): SourceInspectResponse {
  const $ = cheerio.load(html)
  const sourceId = createSourceId('asurascans', sourceUrl)

  const title =
    $('h1').first().text().trim() ||
    $('meta[property="og:title"]').attr('content')?.trim() ||
    $('title').text().trim() ||
    'Sem título'

  const coverImg = $('img[src*="/covers/"]').first()
  const rawCover =
    coverImg.attr('src') ||
    coverImg.attr('data-src') ||
    $('meta[property="og:image"]').attr('content')
  const coverUrl = toAbsoluteUrl(rawCover, sourceUrl)

  const description =
    $('meta[property="og:description"]').attr('content')?.trim() ||
    $('span.font-medium.text-sm').first().text().trim() ||
    null

  let author = $('a[href*="/browse?author="]').first().text().trim() || null
  if (!author) {
    const authorSpan = $('span:contains("Author")').first()
    if (authorSpan.length > 0) {
      const parentRow = authorSpan.closest('div.flex')
      const val = parentRow.find('a, span').not(authorSpan).text().trim()
      if (val) author = val
    }
  }

  let artist = $('a[href*="/browse?artist="]').first().text().trim() || null

  let rawStatus: string | null = null
  $('span, div').each((_, el) => {
    const t = $(el).text().trim().toLowerCase()
    if (['ongoing', 'completed', 'hiatus', 'cancelled'].includes(t)) {
      rawStatus = t
    }
  })

  const genres: string[] = []
  $('a[href*="/browse?genres="]').each((_, el) => {
    const g = $(el).text().trim()
    if (g && !genres.includes(g)) {
      genres.push(g)
    }
  })

  // Parse dos capítulos da obra
  const chLinks = $('a[href*="/chapter/"]').filter((_, el) => {
    const text = $(el).text().trim()
    return !text.includes('First Chapter') && !text.includes('Last Chapter')
  })

  const rawChapters: Array<{
    chapterUrl: string
    chapTitle: string
    chapterNumber: string
  }> = []

  const seenChapters = new Set<string>()

  chLinks.each((_, el) => {
    const rawHref = $(el).attr('href')
    if (!rawHref) return

    const chapterUrl = toAbsoluteUrl(rawHref, sourceUrl)
    if (!chapterUrl || seenChapters.has(chapterUrl)) return
    seenChapters.add(chapterUrl)

    const chapterNumber = extractChapterNumber(rawHref)

    const mainText = $(el).find('span.font-medium').text().trim().replace(/\s+/g, ' ')
    const subText = $(el).find('span.truncate').text().trim().replace(/\s+/g, ' ')
    const fallbackText = $(el).text().trim().replace(/\s+/g, ' ')

    let chapTitle = mainText
    if (mainText && subText) {
      chapTitle = `${mainText} - ${subText}`
    } else if (!chapTitle) {
      chapTitle = fallbackText || `Chapter ${chapterNumber}`
    }

    rawChapters.push({
      chapterUrl,
      chapTitle,
      chapterNumber,
    })
  })

  // Ordena capítulos por número crescente (ex: 1, 2, 3...)
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
    title: c.chapTitle,
    url: c.chapterUrl,
    pages: null,
    volume: null,
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
      author,
      description,
      status: normalizeStatus(rawStatus),
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

/**
 * Extrai as URLs de imagens das páginas de um capítulo do Asura Scans.
 */
export function parseChapterImages(html: string): string[] {
  const $ = cheerio.load(html)
  const images: string[] = []
  const seenImages = new Set<string>()

  $('img').each((_, el) => {
    const src = $(el).attr('src') || $(el).attr('data-src')
    const alt = $(el).attr('alt') || ''

    if (!src) return

    // Verifica se é imagem do leitor (geralmente sob /chapters/ ou com alt "Page X")
    const isReaderImage =
      src.includes('/chapters/') ||
      src.includes('asura-images') ||
      /^page\s*\d+/i.test(alt) ||
      $(el).closest('.w-full, .mx-auto, #readerarea').length > 0

    const isNonContentImage =
      src.includes('logo') ||
      src.includes('icon') ||
      src.includes('avatar') ||
      src.includes('discord') ||
      src.includes('banner')

    if (isReaderImage && !isNonContentImage) {
      const trimmed = src.trim()
      if (!seenImages.has(trimmed)) {
        seenImages.add(trimmed)
        images.push(trimmed)
      }
    }
  })

  return images
}
