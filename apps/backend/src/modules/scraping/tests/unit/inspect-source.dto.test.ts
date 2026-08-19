import { describe, it, expect } from 'vitest'
import { inspectSourceBodySchema } from '../../dtos/inspect-source.dto'

const validBody = { url: 'https://mangalivre.to/manga/hunter-x-hunter/' }

describe('inspectSourceBodySchema — limites de tamanho (VULN-3)', () => {
  it('aceita URL normal', () => {
    const result = inspectSourceBodySchema.safeParse(validBody)
    expect(result.success).toBe(true)
  })

  it('rejeita URL com centenas de KB', () => {
    const url = `https://example.com/manga/${'a'.repeat(300_000)}/`
    expect(inspectSourceBodySchema.safeParse({ url }).success).toBe(false)
  })

  it('rejeita URL acima do limite (2048 chars)', () => {
    const url = `https://example.com/manga/${'a'.repeat(2100)}/`
    expect(inspectSourceBodySchema.safeParse({ url }).success).toBe(false)
  })

  it('rejeita URL whitespace-only', () => {
    expect(inspectSourceBodySchema.safeParse({ url: '   ' }).success).toBe(false)
  })

  it('aceita URL dentro do limite', () => {
    const url = `https://example.com/manga/${'a'.repeat(2000)}/`
    expect(inspectSourceBodySchema.safeParse({ url }).success).toBe(true)
  })
})
