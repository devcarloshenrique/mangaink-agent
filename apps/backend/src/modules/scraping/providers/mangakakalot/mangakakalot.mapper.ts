import * as cheerio from 'cheerio'
import type { SourceInspectResponse, Chapter, Cover } from '../../types/source.types'
import type { ProviderInfo, ProviderSearchResult } from '../../types/provider.types'
import type { MangaKakalotApiChapter } from './mangakakalot.types'
import { createSourceId, createChapterId, createCoverId } from '../../../../shared/utils/id-generator'

export function normalizeStatus(
  rawStatus?: string | null
): 'ongoing' | 'completed' | 'hiatus' | 'cancelled' | 'unknown' {
  if (!rawStatus) return 'unknown'
  const s = rawStatus.toLowerCase().trim()
  if (
    s.includes('ongoing') ||
    s.includes('andamento') ||
    s.includes('lanç') ||
    s.includes('lanc') ||
    s.includes('ativo')
  ) {
    return 'ongoing'
  }
  if (
    s.includes('completed') ||
    s.includes('completo') ||
    s.includes('conclu') ||
    s.includes('finalizado')
  ) {
    return 'completed'
  }
  if (s.includes('hiatus') || s.includes('hiato')) {
    return 'hiatus'
  }
  if (s.includes('cancelled') || s.includes('cancelado') || s.includes('discontinued')) {
    return 'cancelled'
  }
  return 'unknown'
}

export function extractChapterNumber(rawTitle: string, dataNum?: string | null): string {
  if (dataNum && /^\d+(\.\d+)?$/.test(dataNum.trim())) {
    return dataNum.trim()
  }

  const titleToSearch = (rawTitle || dataNum || '').trim()

  const capMatch = titleToSearch.match(/(?:chapter|ch\.?|cap[íi]tulo|cap\.?)\s*(\d+(?:[\.,]\d+)?)/i)
  if (capMatch) {
    return capMatch[1].replace(',', '.')
  }

  if (dataNum) {
    const numMatch = dataNum.match(/(\d+(?:[\.,]\d+)?)/)
    if (numMatch) {
      return numMatch[1].replace(',', '.')
    }
  }

  const fallbackMatch = titleToSearch.match(/(\d+(?:[\.,]\d+)?)/)
  if (fallbackMatch) {
    return fallbackMatch[1].replace(',', '.')
  }

  return dataNum?.trim() || titleToSearch || '0'
}

export function extractVolume(rawTitle: string): number | null {
  const volMatch = rawTitle.match(/(?:vol(?:ume)?\.?)\s*(\d+)/i)
  if (volMatch) {
    const parsed = parseInt(volMatch[1], 10)
    return isNaN(parsed) ? null : parsed
  }
  return null
}

export function parseSearchResults(
  html: string,
  baseUrl: string = 'https://www.mangakakalot.gg'
): ProviderSearchResult[] {
  const $ = cheerio.load(html)
  const results: ProviderSearchResult[] = []
  const seenUrls = new Set<string>()

  $('.story_item, .search-story-item, .panel_story_list .story_item, .list-truyen-item-wrap').each((_, el) => {
    const a = $(el).find('.story_name a, h3 a, a.story_name').first()
    let url = a.attr('href') || $(el).find('a').first().attr('href')
    if (!url) return

    if (url.startsWith('/')) {
      url = `${baseUrl}${url}`
    }

    if (seenUrls.has(url)) return
    seenUrls.add(url)

    const title =
      a.text().trim() ||
      $(el).find('.story_name, h3').first().text().trim() ||
      $(el).find('img').first().attr('alt')?.trim() ||
      ''

    const img = $(el).find('img').first()
    let coverUrl =
      img.attr('data-src') ||
      img.attr('data-lazy-src') ||
      img.attr('src') ||
      null

    if (coverUrl && coverUrl.startsWith('/')) {
      coverUrl = `${baseUrl}${coverUrl}`
    }

    const authorSpan = $(el).find('span:contains("Author")').text()
    const authorMatch = authorSpan.match(/Author(?:\(s\))?\s*:\s*([^<\n\r]+)/i)
    const author = authorMatch ? authorMatch[1].trim() : null

    if (title && url) {
      results.push({
        providerSlug: 'mangakakalot',
        title,
        url,
        coverUrl,
        author,
        type: 'Manga',
      })
    }
  })

  // Fallback: links de /manga/
  if (results.length === 0) {
    $('a[href*="/manga/"]').each((_, el) => {
      let url = $(el).attr('href')
      if (!url) return

      if (url.startsWith('/')) {
        url = `${baseUrl}${url}`
      }

      // Evita links para capítulos ou categorias
      if (url.includes('/chapter-') || url.includes('/genre') || seenUrls.has(url)) return
      seenUrls.add(url)

      const title = $(el).attr('title')?.trim() || $(el).text().trim()
      const img = $(el).find('img').first()
      let coverUrl = img.attr('src') || img.attr('data-src') || null
      if (coverUrl && coverUrl.startsWith('/')) {
        coverUrl = `${baseUrl}${coverUrl}`
      }

      if (title && title.length > 1) {
        results.push({
          providerSlug: 'mangakakalot',
          title,
          url,
          coverUrl,
          type: 'Manga',
        })
      }
    })
  }

  return results
}

export function parseChaptersFromHtml(
  html: string,
  baseUrl: string = 'https://www.mangakakalot.gg'
): Chapter[] {
  const $ = cheerio.load(html)
  const rawChapters: Array<{
    chapterUrl: string
    chapTitle: string
    chapterNumber: string
    volume: number | null
  }> = []
  const seenUrls = new Set<string>()

  $('.chapter-list .row, .row-content-chapter li, ul.row-content-chapter li, .list-chapter li').each((_, el) => {
    const a = $(el).find('a').first()
    let chapterUrl = a.attr('href')
    if (!chapterUrl) return

    if (chapterUrl.startsWith('/')) {
      chapterUrl = `${baseUrl}${chapterUrl}`
    }

    if (seenUrls.has(chapterUrl)) return
    seenUrls.add(chapterUrl)

    const chapTitle = a.text().trim() || a.attr('title')?.trim() || 'Chapter'
    const chapterNumber = extractChapterNumber(chapTitle)
    const volume = extractVolume(chapTitle)

    rawChapters.push({
      chapterUrl,
      chapTitle,
      chapterNumber,
      volume,
    })
  })

  // Fallback para outros links com chapter
  if (rawChapters.length === 0) {
    $('a[href*="/chapter-"], a[href*="/chapter/"]').each((_, el) => {
      let chapterUrl = $(el).attr('href')
      if (!chapterUrl) return

      if (chapterUrl.startsWith('/')) {
        chapterUrl = `${baseUrl}${chapterUrl}`
      }

      if (seenUrls.has(chapterUrl)) return
      seenUrls.add(chapterUrl)

      const chapTitle = $(el).text().trim() || 'Chapter'
      const chapterNumber = extractChapterNumber(chapTitle)
      const volume = extractVolume(chapTitle)

      rawChapters.push({
        chapterUrl,
        chapTitle,
        chapterNumber,
        volume,
      })
    })
  }

  // Ordena em ordem crescente pelo número do capítulo
  rawChapters.sort((a, b) => {
    const numA = parseFloat(a.chapterNumber)
    const numB = parseFloat(b.chapterNumber)
    if (!isNaN(numA) && !isNaN(numB)) {
      return numA - numB
    }
    return a.chapterNumber.localeCompare(b.chapterNumber, undefined, { numeric: true })
  })

  return rawChapters.map((c) => ({
    id: createChapterId(c.chapterNumber),
    number: c.chapterNumber,
    title: c.chapTitle,
    url: c.chapterUrl,
    pages: null,
    volume: c.volume,
    isDownloaded: false,
    isRead: false,
  }))
}

export function mapApiChaptersToChapters(
  apiChapters: MangaKakalotApiChapter[],
  baseUrl: string = 'https://www.mangakakalot.gg',
  mangaSlug: string
): Chapter[] {
  const rawChapters = apiChapters.map((ch) => {
    const chapterNumber = extractChapterNumber(
      ch.chapter_name,
      ch.chapter_num !== undefined ? String(ch.chapter_num) : undefined
    )
    const volume = extractVolume(ch.chapter_name)
    const chapterUrl = `${baseUrl}/manga/${mangaSlug}/${ch.chapter_slug}`

    return {
      chapterUrl,
      chapTitle: ch.chapter_name,
      chapterNumber,
      volume,
    }
  })

  // Ordena em ordem crescente pelo número do capítulo
  rawChapters.sort((a, b) => {
    const numA = parseFloat(a.chapterNumber)
    const numB = parseFloat(b.chapterNumber)
    if (!isNaN(numA) && !isNaN(numB)) {
      return numA - numB
    }
    return a.chapterNumber.localeCompare(b.chapterNumber, undefined, { numeric: true })
  })

  return rawChapters.map((c) => ({
    id: createChapterId(c.chapterNumber),
    number: c.chapterNumber,
    title: c.chapTitle,
    url: c.chapterUrl,
    pages: null,
    volume: c.volume,
    isDownloaded: false,
    isRead: false,
  }))
}

export function mapMangaDetails(
  html: string,
  url: string,
  providerInfo: ProviderInfo,
  baseUrl: string = 'https://www.mangakakalot.gg'
): SourceInspectResponse {
  const $ = cheerio.load(html)

  const title =
    $('h1, .manga-info-text h1, .story-info-right h1, .truyen-info-right h1')
      .first()
      .text()
      .trim() || 'Unknown Title'

  const coverImg = $(
    '.manga-info-pic img, .story-info-left .info-image img, .story-info-left img, .manga-info-top img, meta[property="og:image"]'
  ).first()

  let coverUrl =
    coverImg.attr('content') ||
    coverImg.attr('data-src') ||
    coverImg.attr('src') ||
    null

  if (coverUrl && coverUrl.startsWith('/')) {
    coverUrl = `${baseUrl}${coverUrl}`
  }

  // Descrição/Sinopse
  let description: string | null = null
  const descElem = $('#noidungm, #story_discription, .panel-story-info-description').first()
  if (descElem.length > 0) {
    const clone = descElem.clone()
    clone.find('h2, h3').remove()
    description = clone.text().trim() || null
  }

  if (!description) {
    const summaryH2 = $('h2, h3').filter((_, el) => $(el).text().toLowerCase().includes('summary')).first()
    if (summaryH2.length > 0) {
      const parent = summaryH2.parent()
      const clone = parent.clone()
      clone.find('h2, h3').remove()
      description = clone.text().trim() || null
    }
  }

  // Status, autores, gêneros
  let author: string | null = null
  let artist: string | null = null
  let statusRaw: string | null = null
  const genres: string[] = []

  // Busca em listas ou tabelas com metadados
  const infoText = $('.manga-info-text, .story-info-right, .truyen-info-right').text()

  const statusMatch = infoText.match(/Status\s*:\s*([^<\n\r]+)/i)
  if (statusMatch) {
    statusRaw = statusMatch[1].trim()
  }

  const authorMatch = infoText.match(/Author(?:\(s\))?\s*:\s*([^<\n\r]+)/i)
  if (authorMatch) {
    author = authorMatch[1].trim()
  }

  // Gêneros por links
  $('a[href*="/genre/"], a[href*="/genres/"], a[href*="category="]').each((_, el) => {
    const g = $(el).text().trim()
    if (g && !genres.includes(g)) {
      genres.push(g)
    }
  })

  // Se não achou links de gêneros, busca por regex no texto
  if (genres.length === 0) {
    const genreMatch = infoText.match(/Genres?\s*:\s*([^<\n\r]+)/i)
    if (genreMatch) {
      genreMatch[1].split(',').forEach((g) => {
        const trimmed = g.trim()
        if (trimmed && !genres.includes(trimmed)) genres.push(trimmed)
      })
    }
  }

  const chapters = parseChaptersFromHtml(html, baseUrl)

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

  const sourceId = createSourceId(providerInfo.slug, url)

  return {
    sourceId,
    status: 'ready',
    provider: providerInfo,
    source: {
      url,
      language: 'en',
    },
    metadata: {
      title,
      author,
      description,
      status: normalizeStatus(statusRaw),
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

export function parseChapterImages(
  html: string,
  baseUrl: string = 'https://www.mangakakalot.gg'
): string[] {
  const images: string[] = []
  const seenUrls = new Set<string>()

  // 1. Script com arrays var chapterImages = [...] e var cdns = [...]
  const chapterImagesMatch = html.match(/var\s+chapterImages\s*=\s*(\[[^\]]+\])/i)
  const cdnsMatch = html.match(/var\s+cdns\s*=\s*(\[[^\]]+\])/i)

  if (chapterImagesMatch) {
    try {
      const parsedImages = JSON.parse(chapterImagesMatch[1]) as string[]
      let cdn = 'https://imgs-2.2xstorage.com'
      if (cdnsMatch) {
        try {
          const parsedCdns = JSON.parse(cdnsMatch[1]) as string[]
          if (parsedCdns.length > 0 && parsedCdns[0]) {
            cdn = parsedCdns[0].replace(/\\/g, '')
          }
        } catch {
          // usa cdn padrão
        }
      }

      for (const img of parsedImages) {
        let cleanImg = img.replace(/\\/g, '').trim()
        if (!cleanImg) continue
        const fullUrl = cleanImg.startsWith('http') ? cleanImg : `${cdn}/${cleanImg.replace(/^\//, '')}`
        if (!seenUrls.has(fullUrl)) {
          seenUrls.add(fullUrl)
          images.push(fullUrl)
        }
      }
    } catch {
      // continua para o fallback de cheerio
    }
  }

  // 2. Seletor do leitor HTML
  if (images.length === 0) {
    const $ = cheerio.load(html)
    $(
      '.container-chapter-reader img, #vungdoc img, .reader-content img, .chapter-content img, div[class*="reader"] img, img.PB0mN, img[src*="mghcdn.com"], img[data-src*="mghcdn.com"]'
    ).each((_, el) => {
      let src =
        $(el).attr('src') ||
        $(el).attr('data-src') ||
        $(el).attr('data-original') ||
        $(el).attr('data-cdn') ||
        null

      if (!src) return

      if (src.startsWith('//')) {
        src = `https:${src}`
      } else if (src.startsWith('/')) {
        src = `${baseUrl}${src}`
      }

      // Filtra propagandas, ícones ou logos
      const lower = src.toLowerCase()
      if (
        lower.includes('banner') ||
        lower.includes('ad.') ||
        lower.includes('ads.') ||
        lower.includes('logo') ||
        lower.includes('icon') ||
        lower.includes('discord')
      ) {
        return
      }

      if (!seenUrls.has(src)) {
        seenUrls.add(src)
        images.push(src)
      }
    })
  }

  return images
}
