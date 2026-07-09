import { describe, expect, it } from 'vitest'
import { normalizeUrl } from '../../../../shared/utils/url-normalizer'

describe('URL Normalizer', () => {
  it('deve remover parâmetros utm_', () => {
    const result = normalizeUrl('https://mangalivre.to/manga/hxh?utm_source=twitter&utm_medium=social')
    expect(result).toBe('https://mangalivre.to/manga/hxh/')
  })

  it('deve remover fbclid', () => {
    const result = normalizeUrl('https://mangalivre.to/manga/hxh?fbclid=abc123')
    expect(result).toBe('https://mangalivre.to/manga/hxh/')
  })

  it('deve remover gclid', () => {
    const result = normalizeUrl('https://mangalivre.to/manga/hxh?gclid=abc123')
    expect(result).toBe('https://mangalivre.to/manga/hxh/')
  })

  it('deve remover msclkid', () => {
    const result = normalizeUrl('https://mangalivre.to/manga/hxh?msclkid=abc123')
    expect(result).toBe('https://mangalivre.to/manga/hxh/')
  })

  it('deve remover parâmetro ref', () => {
    const result = normalizeUrl('https://mangalivre.to/manga/hxh?ref=homepage')
    expect(result).toBe('https://mangalivre.to/manga/hxh/')
  })

  it('deve remover fragmentos', () => {
    const result = normalizeUrl('https://mangalivre.to/manga/hxh/#section')
    expect(result).toBe('https://mangalivre.to/manga/hxh/')
  })

  it('deve garantir barra final no pathname', () => {
    const result = normalizeUrl('https://mangalivre.to/manga/hxh')
    expect(result).toBe('https://mangalivre.to/manga/hxh/')
  })

  it('deve manter URL intacta quando não há tracking params', () => {
    const result = normalizeUrl('https://mangalivre.to/manga/hunter-x-hunter/')
    expect(result).toBe('https://mangalivre.to/manga/hunter-x-hunter/')
  })

  it('deve remover tracking params arbitrários começando com utm_', () => {
    const result = normalizeUrl('https://mangalivre.to/manga/hxh?utm_custom=value&utm_term=keyword')
    expect(result).toBe('https://mangalivre.to/manga/hxh/')
  })

  it('deve preservar query params não tracking', () => {
    const result = normalizeUrl('https://mangalivre.to/manga/hxh?page=1&order=asc')
    expect(result).toBe('https://mangalivre.to/manga/hxh/?page=1&order=asc')
  })

  it('deve remover múltiplos tracking params simultaneamente', () => {
    const result = normalizeUrl('https://mangalivre.to/manga/hxh?utm_source=twitter&fbclid=xyz&ref=test#frag')
    expect(result).toBe('https://mangalivre.to/manga/hxh/')
  })

  it('deve lançar erro para URL inválida', () => {
    expect(() => normalizeUrl('not-a-valid-url')).toThrow()
  })
})