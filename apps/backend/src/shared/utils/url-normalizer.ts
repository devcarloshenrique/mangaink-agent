/**
 * Parâmetros de rastreamento que devem ser removidos antes da canonicalização.
 */
const TRACKING_PARAMS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm',
  'fbclid',
  'gclid',
  'msclkid',
  'ref',
  'referrer',
]

/**
 * Normaliza uma URL para sua forma canônica:
 * 1. Remove parâmetros de rastreamento
 * 2. Remove fragmentos (#...)
 * 3. Garante barra final
 *
 * URLs equivalentes geram exatamente a mesma string canônica,
 * garantindo que o sourceId seja determinístico.
 *
 * @example
 * normalizeUrl('https://mangalivre.to/manga/hxh?utm=test#section')
 * // => 'https://mangalivre.to/manga/hxh/'
 */
export function normalizeUrl(rawUrl: string): string {
  const parsed = new URL(rawUrl)

  // Remove fragmento
  parsed.hash = ''

  // Remove tracking params
  for (const param of TRACKING_PARAMS) {
    parsed.searchParams.delete(param)
  }

  // Remove todos os params que começam com utm_
  const keysToDelete: string[] = []
  parsed.searchParams.forEach((_, key) => {
    if (key.startsWith('utm_')) keysToDelete.push(key)
  })
  keysToDelete.forEach((k) => parsed.searchParams.delete(k))

  // Garante barra final no pathname
  if (!parsed.pathname.endsWith('/')) {
    parsed.pathname += '/'
  }

  return parsed.toString()
}
