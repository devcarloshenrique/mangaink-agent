import { sha256 } from './hash'

/**
 * Extrai o slug da obra a partir da URL canônica.
 * Ex: 'https://mangalivre.to/manga/hunter-x-hunter/' → 'hunter-x-hunter'
 */
function getMangaSlug(canonicalUrl: string): string {
  const match = new URL(canonicalUrl).pathname.match(/\/manga\/([^/]+)/)
  return match?.[1] ?? 'unknown'
}

/**
 * Gera um sourceId determinístico.
 *
 * Formato: src-{slug}-{sha256(provider+canonicalUrl)[0..7]}
 *
 * @example
 * createSourceId('mangalivre', 'https://mangalivre.to/manga/hunter-x-hunter/')
 * // => 'src-hunter-x-hunter-a34f19c2'
 */
export function createSourceId(provider: string, canonicalUrl: string): string {
  const slug = getMangaSlug(canonicalUrl)
  const hash = sha256(`${provider}${canonicalUrl}`).slice(0, 8)
  return `src-${slug}-${hash}`
}

/**
 * Gera um ID de capítulo preservando ordenação com números decimais.
 *
 * | Número | ID           |
 * |--------|--------------|
 * | 1      | chap_0001    |
 * | 10     | chap_0010    |
 * | 10.1   | chap_0010_1  |
 * | 10.5   | chap_0010_5  |
 * | 10.10  | chap_0010_10 |
 */
export function createChapterId(number: string | number): string {
  const normalized = String(number)
    .replace(/[^\d._-]/g, '')
    .replace(/[._-]/, '_')

  const [intPart, decPart] = normalized.split('_')
  const padded = (intPart ?? '0').padStart(4, '0')

  return decPart ? `chap_${padded}_${decPart}` : `chap_${padded}`
}

/**
 * Gera um ID de capa com padding sequencial.
 * Ex: createCoverId(1) → 'cover_001'
 */
export function createCoverId(index: number): string {
  return `cover_${String(index).padStart(3, '0')}`
}
