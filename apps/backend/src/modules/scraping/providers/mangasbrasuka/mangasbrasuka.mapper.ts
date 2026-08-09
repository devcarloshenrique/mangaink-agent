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
import type { BrasukaObra, BrasukaCapitulo, BrasukaPagina } from './mangasbrasuka.types'

// ─── Constantes ─────────────────────────────────────────────────────────────

const PROVIDER_SLUG = 'mangasbrasuka'
const BASE_URL = 'https://mangasbrasuka.com.br'
const API_BASE = 'https://app.mangasbrasuka.com.br'

const PROVIDER_INFO: ProviderInfo = {
  slug: PROVIDER_SLUG,
  name: 'Mangas Brasukas',
  engine: 'api',
}

const CHAPTER_URL_PATTERN =
  /mangasbrasuka\.com\.br\/(manga|manhwa|manhua|novel|light-novel)\/([^/]+)\/(\d+(?:\.\d+)?)/

// ─── Utilitários ────────────────────────────────────────────────────────────

/**
 * Resolve o status de publicação da obra para o formato do domínio.
 */
export function resolveStatus(publicationStatus: string | null): string {
  const s = publicationStatus?.toLowerCase() ?? ''
  if (s.includes('ongoing') || s.includes('andamento') || s.includes('ativo')) return 'ongoing'
  if (s.includes('completed') || s.includes('complet') || s.includes('finaliz')) return 'completed'
  if (s.includes('hiatus') || s.includes('hiato') || s.includes('pausa')) return 'hiatus'
  if (s.includes('cancel')) return 'cancelled'
  return 'unknown'
}

/**
 * Normaliza o número do capítulo da API para string do domínio.
 * 121 → "121", 76.5 → "76.5"
 */
export function normalizeChapterNumber(number: number | string): string {
  const n = typeof number === 'number' ? number : parseFloat(number)
  if (Number.isNaN(n)) return String(number)
  return Number.isInteger(n) ? String(Math.trunc(n)) : String(n)
}

/**
 * Extrai o tipo da obra (manga/manhwa/...) a partir da URL.
 */
export function getWorkType(url: string): string {
  try {
    return (
      new URL(url).pathname.match(/\/(manga|manhwa|manhua|novel|light-novel)\//)?.[1] ?? 'manga'
    )
  } catch {
    return 'manga'
  }
}

/**
 * Extrai o slug da obra a partir da URL.
 */
export function getMangaSlug(url: string): string {
  try {
    return (
      new URL(url).pathname.match(/\/(?:manga|manhwa|manhua|novel|light-novel)\/([^/]+)/)?.[1] ??
      'unknown'
    )
  } catch {
    return 'unknown'
  }
}

/**
 * Parseia uma URL de capítulo do Mangas Brasukas.
 * Retorna tipo, slug e número, ou null se a URL não corresponder.
 */
export function parseChapterUrl(
  url: string,
): { type: string; slug: string; number: string } | null {
  const match = url.match(CHAPTER_URL_PATTERN)
  if (!match) return null
  const [, type, slug, number] = match
  return { type, slug, number: normalizeChapterNumber(number) }
}

/**
 * Constrói a URL do capítulo a partir do tipo, slug e número.
 */
function buildChapterUrl(type: string, slug: string, number: string): string {
  return `${BASE_URL}/${type}/${slug}/${number}`
}

// ─── Mappers ────────────────────────────────────────────────────────────────

/**
 * Mapeia a resposta da API de obra + capítulos para SourceInspectResponse.
 */
export function mapObraToInspectResponse(
  obra: BrasukaObra,
  chapters: BrasukaCapitulo[],
  slug: string,
  canonicalUrl: string,
): SourceInspectResponse {
  const type = getWorkType(canonicalUrl)
  const sourceId = createSourceId(PROVIDER_SLUG, canonicalUrl)
  const metadata = mapMetadata(obra)
  const covers = mapCovers(obra)
  const mappedChapters = mapChapters(chapters, type, slug)
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

function mapMetadata(obra: BrasukaObra): MangaMetadata {
  const genres = (obra.tags ?? []).map((t) => t?.trim()).filter((g): g is string => Boolean(g))

  return {
    title: obra.title?.trim() || 'Manga Desconhecido',
    author: obra.author?.trim() || null,
    description: obra.description?.trim() || null,
    status: resolveStatus(obra.publicationStatus),
    genres,
  }
}

function mapCovers(obra: BrasukaObra): Cover[] {
  if (!obra.coverUrl) return []
  return [
    {
      id: createCoverId(1),
      type: 'original',
      label: 'Original',
      imageUrl: obra.coverUrl,
    },
  ]
}

function mapChapters(chapters: BrasukaCapitulo[], type: string, slug: string): Chapter[] {
  const mapped: Chapter[] = (chapters ?? []).map((cap) => {
    const number = normalizeChapterNumber(cap.number)
    return {
      id: createChapterId(number),
      number,
      title: cap.title?.trim() || `Capítulo ${number}`,
      url: buildChapterUrl(type, slug, number),
      pages: null,
      volume: null,
      isDownloaded: false,
      isRead: false,
    }
  })

  // Ordena crescente por número (suporte a decimais)
  mapped.sort((a, b) => parseFloat(a.number) - parseFloat(b.number))
  return mapped
}

/**
 * Extrai URLs de imagens das páginas de um capítulo.
 */
export function mapPaginasToImageUrls(paginas: BrasukaPagina[]): string[] {
  return (paginas ?? [])
    .slice()
    .sort((a, b) => a.index - b.index)
    .map((p) => p.imageUrl)
}

/**
 * Retorna o ProviderInfo para uso na resposta da API.
 */
export function buildProviderInfo(): ProviderInfo {
  return PROVIDER_INFO
}

/** API base exposta para o provider. */
export function getApiBase(): string {
  return API_BASE
}
