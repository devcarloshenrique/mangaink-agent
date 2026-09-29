import { describe, expect, it } from 'vitest'
import { coverProxyQuerySchema, searchSourcesQuerySchema } from '../../dtos/search-sources.dto'

const KNOWN = ['mangalivre', 'imperiodabritannia', 'mangadex']

describe('searchSourcesQuerySchema', () => {
  it('aceita query válida com defaults', () => {
    const parsed = searchSourcesQuerySchema.parse({ q: 'one piece' })
    expect(parsed).toMatchObject({ q: 'one piece', limit: 10, offset: 0, timeoutMs: 12000 })
  })

  it('aceita timeoutMs e maxProviders customizados', () => {
    const parsed = searchSourcesQuerySchema.parse({ q: 'one piece', timeoutMs: '15000', maxProviders: '15' })
    expect(parsed.timeoutMs).toBe(15000)
    expect(parsed.maxProviders).toBe(15)
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

  it('rejeita mais que 50 slugs', () => {
    const csv = Array.from({ length: 51 }, (_, i) => KNOWN[i % KNOWN.length]).join(',')
    expect(() => searchSourcesQuerySchema.parse({ q: 'naruto', providers: csv })).toThrow()
  })

  it('valida coverProxyQuerySchema corretamente', () => {
    expect(() => coverProxyQuerySchema.parse({ url: 'not-a-url', provider: 'mangakakalot' })).toThrow()
    expect(() => coverProxyQuerySchema.parse({ url: 'https://example.com/cover.jpg', provider: '' })).toThrow()
    const valid = coverProxyQuerySchema.parse({
      url: 'https://img-r1.2xstorage.com/thumb/naruto.webp',
      provider: 'mangakakalot',
    })
    expect(valid).toEqual({
      url: 'https://img-r1.2xstorage.com/thumb/naruto.webp',
      provider: 'mangakakalot',
    })
  })
})
