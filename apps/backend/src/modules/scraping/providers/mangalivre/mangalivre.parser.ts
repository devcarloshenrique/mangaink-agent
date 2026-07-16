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

/**
 * Remove o sufixo de resolucao WordPress (-WxH) da URL da imagem.
 *
 * Exemplo:
 *   https://ex.com/HUNTER-x-HUNTER-193x278.webp → https://ex.com/HUNTER-x-HUNTER.webp
 */
function stripResolutionSuffix(url: string): string {
  if (!url.includes('wp-content')) return url

  try {
    const parsed = new URL(url)
    const match = parsed.pathname.match(/^(.+)\-\d+x\d+(\.\w+)$/)
    if (match) {
      parsed.pathname = match[1] + match[2]
      return parsed.href
    }
  } catch {
    // URL invalida, retorna original
  }

  return url
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

  // Remove sufixo de resolucao (-WxH) para obter a imagem em qualidade original
  const fullResUrl = stripResolutionSuffix(imageUrl)

  return [
    {
      id: createCoverId(1),
      type: 'original',
      label: 'Original',
      imageUrl: fullResUrl,
    },
  ]
}

export function parseChapters($: CheerioAPI, base: string, canonicalUrl: string): Chapter[] {
  const mangaSlug = getMangaSlug(canonicalUrl)
  const seen = new Set<string>()
  const chapters: Chapter[] = []

  $(SEL.chapters).each((_, el) => {
    // Pula elementos que são botões de ação (btn-read-first/last), não capítulos reais
    const elClass = $(el).attr('class') ?? ''
    const elId = $(el).attr('id') ?? ''
    if (elClass.includes('c-btn') || elId.startsWith('btn-read-')) return

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

/**
 * Extrai URLs de imagens de uma página de capítulo.
 *
 * Estratégias em ordem de prioridade:
 * 1. <img> tags dentro do container do leitor (src ou data-src)
 * 2. <script> tag contendo array de URLs de imagens
 * 3. Qualquer <img> na página com data-src apontando para domínios de imagem
 *
 * @param $ - CheerioAPI carregado com HTML da página do capítulo
 * @param base - URL base para resolver URLs relativas
 * @returns Lista de URLs absolutas das imagens do capítulo
 */
export function parseChapterImages($: CheerioAPI, base: string): string[] {
  const seen = new Set<string>()
  const images: string[] = []

  // ── Estratégia 1: <img> dentro do container do leitor ────────────
  $(SEL.chapterImages).each((_, el) => {
    const $el = $(el)

    // Tenta data-src primeiro (lazy loading), depois src
    const src =
      $el.attr('data-src') ||
      $el.attr('data-lazy-src') ||
      $el.attr('src')

    if (!src) return

    const absolute = absoluteUrl(src, base)
    if (!absolute || seen.has(absolute)) return

    // Filtra apenas URLs de imagem
    if (!isImageUrl(absolute)) return

    seen.add(absolute)
    images.push(absolute)
  })

  // ── Estratégia 2: se não achou nada, procura em scripts ──────────
  if (images.length === 0) {
    $(SEL.imageScript).each((_, el) => {
      const text = $(el).text()

      // Tenta encontrar arrays de URLs em diferentes formatos
      const patterns = [
        /images\s*=\s*(\[[^\]]+\])/i,
        /imgs\s*=\s*(\[[^\]]+\])/i,
        /pages\s*=\s*(\[[^\]]+\])/i,
        /"images"\s*:\s*(\[[^\]]+\])/i,
        /urls\s*=\s*(\[[^\]]+\])/i,
      ]

      for (const pattern of patterns) {
        const match = text.match(pattern)
        if (!match) continue

        try {
          // Avalia o array de forma segura (JSON ou JS literal)
          const parsed = tryParseStringArray(match[1])
          if (parsed.length > 0) {
            for (const url of parsed) {
              const absolute = absoluteUrl(url, base)
              if (absolute && !seen.has(absolute) && isImageUrl(absolute)) {
                seen.add(absolute)
                images.push(absolute)
              }
            }
            return // Sai se encontrou algo
          }
        } catch {
          continue // Próximo pattern
        }
      }
    })
  }

  return images
}

/**
 * Verifica se uma URL parece ser de uma imagem.
 */
function isImageUrl(url: string): boolean {
  // Verifica extensão comum de imagem
  const imageExtensions = /\.(jpg|jpeg|png|gif|webp|bmp|avif)(\?|#|$)/i
  if (imageExtensions.test(url)) return true

  // Verifica se o path contém indicadores de imagem
  const imageIndicators = /\/wp-content\/uploads\//i
  if (imageIndicators.test(url)) return true

  return false
}

/**
 * Tenta fazer parse de um array de strings a partir de uma string literal.
 * Suporta tanto JSON válido quanto arrays JS com aspas simples.
 */
function tryParseStringArray(input: string): string[] {
  // Tenta como JSON primeiro
  try {
    const parsed = JSON.parse(input)
    if (Array.isArray(parsed) && parsed.every((i) => typeof i === 'string')) {
      return parsed
    }
  } catch {
    // Ignora
  }

  // Tenta converter aspas simples para duplas e re-tentar
  try {
    const normalized = input
      .replace(/'/g, '"')
      .replace(/(\w+):/g, '"$1":') // Converte keys sem aspas
    const parsed = JSON.parse(normalized)
    if (Array.isArray(parsed) && parsed.every((i) => typeof i === 'string')) {
      return parsed
    }
  } catch {
    // Ignora
  }

  return []
}
