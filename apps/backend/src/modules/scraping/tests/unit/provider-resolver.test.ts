import { describe, expect, it, beforeEach } from 'vitest'
import { ProviderResolver } from '../../providers/provider-resolver'
import { ProviderNotFoundError, InvalidUrlError } from '../../errors/scraping.errors'

describe('ProviderResolver', () => {
  let resolver: ProviderResolver

  beforeEach(() => {
    resolver = new ProviderResolver()
  })

  describe('resolve', () => {
    it('deve resolver provider para URL do MangaLivre', () => {
      const provider = resolver.resolve('https://mangalivre.to/manga/hunter-x-hunter/')
      expect(provider.slug).toBe('mangalivre')
      expect(provider.name).toBe('Manga Livre')
      expect(provider.engine).toBe('cheerio')
    })

    it('deve resolver provider para URL sem barra final', () => {
      const provider = resolver.resolve('https://mangalivre.to/manga/hunter-x-hunter')
      expect(provider.slug).toBe('mangalivre')
    })

    it('deve lançar ProviderNotFoundError para URL não suportada', () => {
      expect(() => resolver.resolve('https://example.com/manga/test/')).toThrow(
        ProviderNotFoundError,
      )
    })

    it('deve lançar InvalidUrlError para URL malformada', () => {
      expect(() => resolver.resolve('not-a-url')).toThrow(InvalidUrlError)
    })

    it('deve lançar InvalidUrlError para string vazia', () => {
      expect(() => resolver.resolve('')).toThrow(InvalidUrlError)
    })

    it('deve proteger contra SSRF (domínios não autorizados)', () => {
      expect(() => resolver.resolve('https://evil.com/manga/test/')).toThrow(ProviderNotFoundError)
    })

    it('deve ser case-sensitive para hostname', () => {
      const provider = resolver.resolve('https://MANGALIVRE.to/manga/test/')
      expect(provider.slug).toBe('mangalivre')
    })

    it('deve resolver provider para URL do ImperioDaBritannia', () => {
      const provider = resolver.resolve('https://imperiodabritannia.net/manga/meu-manga/')
      expect(provider.slug).toBe('imperiodabritannia')
      expect(provider.name).toBe('Imperio da Britannia')
      expect(provider.engine).toBe('api')
    })

    it('deve resolver provider para URL do ImperioDaBritannia sem barra final', () => {
      const provider = resolver.resolve('https://imperiodabritannia.net/manga/meu-manga')
      expect(provider.slug).toBe('imperiodabritannia')
    })

    it('deve resolver provider para URL do Mangas Brasukas', () => {
      const provider = resolver.resolve(
        'https://mangasbrasuka.com.br/manga/mushoku-tensei-jobless-reincarnation/',
      )
      expect(provider.slug).toBe('mangasbrasuka')
      expect(provider.name).toBe('Mangas Brasukas')
      expect(provider.engine).toBe('api')
    })

    it('deve resolver provider para URL do Mangas Brasukas sem barra final', () => {
      const provider = resolver.resolve('https://mangasbrasuka.com.br/manhwa/meu-manga')
      expect(provider.slug).toBe('mangasbrasuka')
    })
  })

  describe('listAll', () => {
    it('deve listar todos os providers disponíveis', () => {
      const providers = resolver.listAll()
      expect(providers).toHaveLength(3)
      const slugs = providers.map((p) => p.slug)
      expect(slugs).toContain('mangalivre')
      expect(slugs).toContain('imperiodabritannia')
      expect(slugs).toContain('mangasbrasuka')
    })

    it('deve retornar providers com informações completas', () => {
      const [provider] = resolver.listAll()
      expect(provider).toHaveProperty('slug')
      expect(provider).toHaveProperty('name')
      expect(provider).toHaveProperty('engine')
      expect(provider).toHaveProperty('urlPattern')
      expect(provider).toHaveProperty('allowedDomains')
    })
  })
})
