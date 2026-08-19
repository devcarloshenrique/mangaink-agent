import { describe, it, expect } from 'vitest'
import { createConversionBodySchema } from '../../dtos/create-conversion.dto'

const validBody = {
  sourceId: 'src-hunter-x-hunter-a34f19c2',
  cover: { kind: 'original' },
  output: { deviceId: 'kpw_11', format: 'EPUB' },
  metadata: { title: 'Hunter x Hunter', author: 'Yoshihiro Togashi' },
  books: [
    { title: 'Hunter x Hunter', chapters: ['chap_0001', 'chap_0002'] },
  ],
}

describe('createConversionBodySchema — limites de tamanho (VULN-3)', () => {
  it('aceita payload normal (valores dentro dos limites)', () => {
    const result = createConversionBodySchema.safeParse(validBody)
    expect(result.success).toBe(true)
  })

  it('rejeita título de book com centenas de KB', () => {
    const body = {
      ...validBody,
      books: [{ title: 'A'.repeat(300_000), chapters: ['chap_0001'] }],
    }
    expect(createConversionBodySchema.safeParse(body).success).toBe(false)
  })

  it('rejeita título de book acima do limite (500 chars)', () => {
    const body = {
      ...validBody,
      books: [{ title: 'A'.repeat(501), chapters: ['chap_0001'] }],
    }
    expect(createConversionBodySchema.safeParse(body).success).toBe(false)
  })

  it('rejeita item de chapters acima do limite (100 chars)', () => {
    const body = {
      ...validBody,
      books: [{ title: 'Hunter x Hunter', chapters: ['x'.repeat(101)] }],
    }
    expect(createConversionBodySchema.safeParse(body).success).toBe(false)
  })

  it('rejeita metadata.title acima do limite (500 chars)', () => {
    const body = {
      ...validBody,
      metadata: { title: 'A'.repeat(501), author: 'Yoshihiro Togashi' },
    }
    expect(createConversionBodySchema.safeParse(body).success).toBe(false)
  })

  it('rejeita metadata.author acima do limite (2000 chars)', () => {
    const body = {
      ...validBody,
      metadata: { title: 'Hunter x Hunter', author: 'A'.repeat(2001) },
    }
    expect(createConversionBodySchema.safeParse(body).success).toBe(false)
  })

  it('rejeita título whitespace-only', () => {
    const body = {
      ...validBody,
      books: [{ title: '   ', chapters: ['chap_0001'] }],
    }
    expect(createConversionBodySchema.safeParse(body).success).toBe(false)
  })

  it('rejeita item de chapters whitespace-only', () => {
    const body = {
      ...validBody,
      books: [{ title: 'Hunter x Hunter', chapters: ['   '] }],
    }
    expect(createConversionBodySchema.safeParse(body).success).toBe(false)
  })

  it('aceita valores dentro dos limites (500/100/500/2000)', () => {
    const body = {
      ...validBody,
      metadata: {
        title: 'T'.repeat(500),
        author: 'A'.repeat(2000),
      },
      books: [
        { title: 'T'.repeat(500), chapters: ['c'.repeat(100)] },
      ],
    }
    const result = createConversionBodySchema.safeParse(body)
    expect(result.success).toBe(true)
  })
})
