import { createSourceId, createChapterId, createCoverId } from '../../../../shared/utils/id-generator'
import type { SourceInspectResponse, Chapter, Cover, MangaMetadata, SourceInfo } from '../../types/source.types'
import type { ProviderInfo } from '../../types/provider.types'
import type { BritanniaObra, BritanniaCapituloDetalhado } from './imperiodabritannia.types'

// ─── Constantes ─────────────────────────────────────────────────────────────

const PROVIDER_SLUG = 'imperiodabritannia'
const BASE_URL = 'https://imperiodabritannia.net'
const CDN_BASE = 'https://cdn.imperiodabritannia.net'

const PROVIDER_INFO: ProviderInfo = {
  slug: PROVIDER_SLUG,
  name: 'Imperio da Britannia',
  engine: 'api',
}

const CHAPTER_URL_PATTERN = /imperiodabritannia\.net\/manga\/([^/]+)\/capitulo\/(\d+(?:\.\d+)?)/

// ─── Utilitários ────────────────────────────────────────────────────────────

/**
 * Resolve o status da obra para o formato do domínio.
 * Case-insensitive, retorna 'unknown' para valores não reconhecidos.
 */
export function resolveStatus(statusNome: string | null): string {
  if (!statusNome) return 'unknown'
  const s = statusNome.toLowerCase()
  if (s.includes('ativo') || s.includes('andamento') || s.includes('ongoing')) return 'ongoing'
  if (s.includes('complet') || s.includes('finaliz') || s.includes('encerr')) return 'completed'
  if (s.includes('hiato') || s.includes('pausa') || s.includes('hiatus')) return 'hiatus'
  if (s.includes('cancel')) return 'cancelled'
  return 'unknown'
}

/**
 * Normaliza o número do capítulo da API.
 * "1.00" → "1", "10.50" → "10.5", "5" → "5"
 */
export function normalizeChapterNumber(rawNumber: string): string {
  const n = parseFloat(rawNumber)
  return Number.isInteger(n) ? String(Math.trunc(n)) : String(n)
}

/**
 * Extrai o slug do manga a partir da URL.
 */
export function getMangaSlug(url: string): string {
  try {
    return new URL(url).pathname.match(/\/manga\/([^/]+)/)?.[1] ?? 'unknown'
  } catch {
    return 'unknown'
  }
}

/**
 * Parseia uma URL de capítulo do ImperioDaBritannia.
 * Retorna slug e número, ou null se a URL não corresponder.
 */
export function parseChapterUrl(url: string): { slug: string; numero: number } | null {
  const match = url.match(CHAPTER_URL_PATTERN)
  if (!match) return null
  const [, slug, numero] = match
  return { slug, numero: parseFloat(numero) }
}

/**
 * Remove caracteres proibidos em nomes de arquivo.
 */
function sanitizeFileName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Constrói a URL do capítulo a partir do slug e número.
 */
function buildChapterUrl(slug: string, number: string): string {
  const n = normalizeChapterNumber(number)
  return `${BASE_URL}/manga/${slug}/capitulo/${n}`
}

// ─── Mappers ────────────────────────────────────────────────────────────────

/**
 * Mapeia a resposta da API de obra para o formato SourceInspectResponse.
 */
export function mapObraToInspectResponse(
  obra: BritanniaObra,
  slug: string,
  canonicalUrl: string,
): SourceInspectResponse {
  const sourceId = createSourceId(PROVIDER_SLUG, canonicalUrl)
  const metadata = mapMetadata(obra)
  const covers = mapCovers(obra)
  const chapters = mapChapters(obra, slug)
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

function mapMetadata(obra: BritanniaObra): MangaMetadata {
  const title = sanitizeFileName(obra.nome || 'Manga Desconhecido')
  const genres = (obra.tags ?? [])
    .map((t) => t.nome?.trim())
    .filter((g): g is string => Boolean(g))

  return {
    title,
    author: null, // API não expõe autor no endpoint de obra
    description: obra.descricao?.trim() || null,
    status: resolveStatus(obra.status_nome),
    genres,
  }
}

function mapCovers(obra: BritanniaObra): Cover[] {
  if (!obra.imagem) return []
  return [
    {
      id: createCoverId(1),
      type: 'original',
      label: 'Original',
      imageUrl: `${CDN_BASE}/${obra.imagem}`,
    },
  ]
}

function mapChapters(obra: BritanniaObra, slug: string): Chapter[] {
  const chapters: Chapter[] = (obra.capitulos ?? []).map((cap) => {
    const number = normalizeChapterNumber(cap.numero)
    return {
      id: createChapterId(number),
      number,
      title: cap.nome?.trim() || `Capítulo ${number}`,
      url: buildChapterUrl(slug, cap.numero),
      pages: cap.total_paginas ?? null,
      volume: null,
      isDownloaded: false,
    }
  })

  // Ordena crescente por número
  chapters.sort((a, b) => parseFloat(a.number) - parseFloat(b.number))
  return chapters
}

/**
 * Extrai URLs de imagens das páginas de um capítulo.
 * Lança erro se o capítulo estiver bloqueado por paywall.
 */
export function mapCapituloToImageUrls(capitulo: BritanniaCapituloDetalhado): string[] {
  if (capitulo.paywall_bloqueado) {
    const priceMsg = capitulo.preco_moedas
      ? ` Custa ${capitulo.preco_moedas} moedas.`
      : ' Requer assinatura VIP.'
    throw new Error(
      `Capítulo ${normalizeChapterNumber(capitulo.numero)} está bloqueado por paywall.${priceMsg}`,
    )
  }

  return (capitulo.paginas ?? [])
    .sort((a, b) => a.numero - b.numero)
    .map((p) => p.cdn_id)
}

/**
 * Retorna o ProviderInfo para uso na resposta da API.
 */
export function buildProviderInfo(): ProviderInfo {
  return PROVIDER_INFO
}
