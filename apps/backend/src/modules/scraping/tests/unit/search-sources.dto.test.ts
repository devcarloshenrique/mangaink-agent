import { describe, expect, it } from 'vitest'
import { searchSourcesQuerySchema } from '../../dtos/search-sources.dto'

const KNOWN = ['mangalivre', 'imperiodabritannia', 'mangasbrasuka', 'mangadex']

describe('searchSourcesQuerySchema', () => {
  it('aceita query válida com defaults', () => {
    const parsed = searchSourcesQuerySchema.parse({ q: 'one piece' })
    expect(parsed).toMatchObject({ q: 'one piece', limit: 10, offset: 0 })
  })

  it('aceita offset válido e respeita limite máximo de 100', () => {
    const parsed = searchSourcesQuerySchema.parse({ q: 'one piece', offset: '50' })
    expect(parsed.offset).toBe(50)
    expect(() => searchSourcesQuerySchema.parse({ q: 'one piece', offset: '-1' })).toThrow()
    expect(() => searchSourcesQuerySchema.parse({ q: 'one piece', offset: '101' })).toThrow()
  })

  it('rejeita q com 1 char', () => {
    expect(() => searchSourcesQuerySchema.parse({ q: 'a' })).toThrow()
  })

  it('aceita slug desconhecido (validado contra strategies vivas no use-case)', () => {
    const parsed = searchSourcesQuerySchema.parse({ q: 'naruto', providers: 'xxx' })
    expect(parsed.providers).toEqual(['xxx'])
  })

  it('aceita language opcional normalizado em minúsculas', () => {
    const parsed = searchSourcesQuerySchema.parse({ q: 'one piece', language: 'PT-BR ' })
    expect(parsed.language).toBe('pt-br')
  })

  it('rejeita mais que 20 slugs', () => {
    const csv = [...KNOWN, ...Array.from({ length: 17 }, (_, i) => KNOWN[i % KNOWN.length])].join(',')
    expect(() => searchSourcesQuerySchema.parse({ q: 'naruto', providers: csv })).toThrow()
  })
})
