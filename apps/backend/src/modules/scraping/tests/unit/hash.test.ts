import { describe, expect, it } from 'vitest'
import { sha256 } from '../../../../shared/utils/hash'

describe('Hash', () => {
  it('deve gerar hash SHA-256 em hexadecimal', () => {
    const result = sha256('test')
    expect(result).toMatch(/^[a-f0-9]{64}$/)
  })

  it('deve ser determinístico (mesma entrada = mesma saída)', () => {
    const a = sha256('mangalivrehttps://mangalivre.to/manga/hunter-x-hunter/')
    const b = sha256('mangalivrehttps://mangalivre.to/manga/hunter-x-hunter/')
    expect(a).toBe(b)
  })

  it('deve gerar hashes diferentes para entradas diferentes', () => {
    const a = sha256('mangalivrehttps://mangalivre.to/manga/hunter-x-hunter/')
    const b = sha256('mangadexhttps://mangadex.org/title/hxh/')
    expect(a).not.toBe(b)
  })

  it('deve aceitar string vazia', () => {
    const result = sha256('')
    expect(result).toMatch(/^[a-f0-9]{64}$/)
  })
})