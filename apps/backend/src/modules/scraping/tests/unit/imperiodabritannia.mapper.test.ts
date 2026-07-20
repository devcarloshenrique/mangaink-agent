import { describe, expect, it } from 'vitest'
import {
  resolveStatus,
  normalizeChapterNumber,
  getMangaSlug,
  parseChapterUrl,
  mapObraToInspectResponse,
  mapCapituloToImageUrls,
} from '../../providers/imperiodabritannia/imperiodabritannia.mapper'
import type {
  BritanniaObra,
  BritanniaCapituloDetalhado,
} from '../../providers/imperiodabritannia/imperiodabritannia.types'

// ─── resolveStatus ──────────────────────────────────────────────────────────

describe('resolveStatus', () => {
  it('deve retornar "ongoing" para "Ativo"', () => {
    expect(resolveStatus('Ativo')).toBe('ongoing')
  })

  it('deve retornar "ongoing" para "Em andamento"', () => {
    expect(resolveStatus('Em andamento')).toBe('ongoing')
  })

  it('deve retornar "ongoing" para "ongoing"', () => {
    expect(resolveStatus('ongoing')).toBe('ongoing')
  })

  it('deve retornar "completed" para "Completo"', () => {
    expect(resolveStatus('Completo')).toBe('completed')
  })

  it('deve retornar "completed" para "Finalizado"', () => {
    expect(resolveStatus('Finalizado')).toBe('completed')
  })

  it('deve retornar "hiatus" para "Hiato"', () => {
    expect(resolveStatus('Hiato')).toBe('hiatus')
  })

  it('deve retornar "cancelled" para "Cancelado"', () => {
    expect(resolveStatus('Cancelado')).toBe('cancelled')
  })

  it('deve retornar "unknown" para null', () => {
    expect(resolveStatus(null)).toBe('unknown')
  })

  it('deve retornar "unknown" para string não reconhecida', () => {
    expect(resolveStatus('status-desconhecido')).toBe('unknown')
  })

  it('deve ser case-insensitive', () => {
    expect(resolveStatus('ATIVO')).toBe('ongoing')
    expect(resolveStatus('completo')).toBe('completed')
    expect(resolveStatus('HIATO')).toBe('hiatus')
  })
})

// ─── normalizeChapterNumber ─────────────────────────────────────────────────

describe('normalizeChapterNumber', () => {
  it('deve converter "1.00" para "1"', () => {
    expect(normalizeChapterNumber('1.00')).toBe('1')
  })

  it('deve converter "10.50" para "10.5"', () => {
    expect(normalizeChapterNumber('10.50')).toBe('10.5')
  })

  it('deve converter "2.00" para "2"', () => {
    expect(normalizeChapterNumber('2.00')).toBe('2')
  })

  it('deve manter "10.5" como "10.5"', () => {
    expect(normalizeChapterNumber('10.5')).toBe('10.5')
  })

  it('deve converter número inteiro 5 para "5"', () => {
    expect(normalizeChapterNumber('5')).toBe('5')
  })
})

// ─── getMangaSlug ───────────────────────────────────────────────────────────

describe('getMangaSlug', () => {
  it('deve extrair slug de URL válida', () => {
    expect(
      getMangaSlug('https://imperiodabritannia.net/manga/meu-manga-favorito'),
    ).toBe('meu-manga-favorito')
  })

  it('deve extrair slug de URL com barra final', () => {
    expect(
      getMangaSlug('https://imperiodabritannia.net/manga/meu-manga-favorito/'),
    ).toBe('meu-manga-favorito')
  })

  it('deve retornar "unknown" para URL sem slug', () => {
    expect(getMangaSlug('https://imperiodabritannia.net/')).toBe('unknown')
  })
})

// ─── parseChapterUrl ────────────────────────────────────────────────────────

describe('parseChapterUrl', () => {
  it('deve extrair slug e número de URL de capítulo', () => {
    const result = parseChapterUrl(
      'https://imperiodabritannia.net/manga/meu-manga/capitulo/10',
    )
    expect(result).toEqual({ slug: 'meu-manga', numero: 10 })
  })

  it('deve tratar números decimais', () => {
    const result = parseChapterUrl(
      'https://imperiodabritannia.net/manga/meu-manga/capitulo/10.5',
    )
    expect(result).toEqual({ slug: 'meu-manga', numero: 10.5 })
  })

  it('deve retornar null para URL inválida', () => {
    expect(parseChapterUrl('https://example.com/manga/test/capitulo/1')).toBeNull()
  })

  it('deve retornar null para URL sem capítulo', () => {
    expect(
      parseChapterUrl('https://imperiodabritannia.net/manga/meu-manga'),
    ).toBeNull()
  })
})

// ─── mapObraToInspectResponse ───────────────────────────────────────────────

describe('mapObraToInspectResponse', () => {
  const baseObra: BritanniaObra = {
    id: 42,
    nome: 'Meu Manga Favorito',
    descricao: 'Uma descrição incrível.',
    imagem: 'uploads/obras/meu-manga.jpg',
    status_nome: 'Ativo',
    tags: [{ nome: 'Ação' }, { nome: 'Fantasia' }],
    capitulos: [
      { numero: '2.00', nome: 'Capítulo 2', total_paginas: 20, paywall: false },
      { numero: '1.00', nome: 'Capítulo 1', total_paginas: 15, paywall: false },
      { numero: '1.50', nome: 'Especial', total_paginas: 10, paywall: true },
    ],
  }

  const slug = 'meu-manga-favorito'
  const canonicalUrl = 'https://imperiodabritannia.net/manga/meu-manga-favorito/'

  it('deve mapear obra completa para SourceInspectResponse', () => {
    const result = mapObraToInspectResponse(baseObra, slug, canonicalUrl)

    expect(result.status).toBe('ready')
    expect(result.metadata.title).toBe('Meu Manga Favorito')
    expect(result.metadata.description).toBe('Uma descrição incrível.')
    expect(result.metadata.genres).toEqual(['Ação', 'Fantasia'])
    expect(result.chapters).toHaveLength(3)
    expect(result.covers).toHaveLength(1)
  })

  it('deve gerar sourceId determinístico', () => {
    const result1 = mapObraToInspectResponse(baseObra, slug, canonicalUrl)
    const result2 = mapObraToInspectResponse(baseObra, slug, canonicalUrl)
    expect(result1.sourceId).toBe(result2.sourceId)
    expect(result1.sourceId).toMatch(/^src-/)
  })

  it('deve mapear gêneros a partir de tags', () => {
    const result = mapObraToInspectResponse(baseObra, slug, canonicalUrl)
    expect(result.metadata.genres).toEqual(['Ação', 'Fantasia'])
  })

  it('deve construir URL de capa com cdnBase', () => {
    const result = mapObraToInspectResponse(baseObra, slug, canonicalUrl)
    expect(result.covers[0].imageUrl).toBe(
      'https://cdn.imperiodabritannia.net/uploads/obras/meu-manga.jpg',
    )
  })

  it('deve retornar covers vazio quando obra não tem imagem', () => {
    const obraSemImagem = { ...baseObra, imagem: null }
    const result = mapObraToInspectResponse(obraSemImagem, slug, canonicalUrl)
    expect(result.covers).toEqual([])
  })

  it('deve ordenar capítulos crescente por número', () => {
    const result = mapObraToInspectResponse(baseObra, slug, canonicalUrl)
    const numbers = result.chapters.map((c) => c.number)
    expect(numbers).toEqual(['1', '1.5', '2'])
  })

  it('deve gerar chapterIds com padding correto', () => {
    const result = mapObraToInspectResponse(baseObra, slug, canonicalUrl)
    const ids = result.chapters.map((c) => c.id)
    expect(ids).toEqual(['chap_0001', 'chap_0001_5', 'chap_0002'])
  })

  it('deve definir status como "ready"', () => {
    const result = mapObraToInspectResponse(baseObra, slug, canonicalUrl)
    expect(result.status).toBe('ready')
  })

  it('deve sanitizar título removendo caracteres proibidos', () => {
    const obra = { ...baseObra, nome: 'Manga: "Test" <special>' }
    const result = mapObraToInspectResponse(obra, slug, canonicalUrl)
    expect(result.metadata.title).not.toMatch(/[<>:"/\\|?*]/)
  })

  it('deve tratar campos nulos (descrição, tags, capítulos)', () => {
    const obraMinima: BritanniaObra = {
      id: 1,
      nome: 'Teste',
      descricao: null,
      imagem: null,
      status_nome: null,
      tags: [],
      capitulos: [],
    }
    const result = mapObraToInspectResponse(obraMinima, 'teste', 'https://imperiodabritannia.net/manga/teste/')
    expect(result.metadata.description).toBeNull()
    expect(result.metadata.genres).toEqual([])
    expect(result.chapters).toEqual([])
    expect(result.covers).toEqual([])
    expect(result.statistics.chapters).toBe(0)
  })

  it('deve incluir provider info com engine "api"', () => {
    const result = mapObraToInspectResponse(baseObra, slug, canonicalUrl)
    expect(result.provider.engine).toBe('api')
    expect(result.provider.slug).toBe('imperiodabritannia')
    expect(result.provider.name).toBe('Imperio da Britannia')
  })

  it('deve incluir source info com URL e language pt-BR', () => {
    const result = mapObraToInspectResponse(baseObra, slug, canonicalUrl)
    expect(result.source.url).toBe(canonicalUrl)
    expect(result.source.language).toBe('pt-BR')
  })
})

// ─── mapCapituloToImageUrls ─────────────────────────────────────────────────

describe('mapCapituloToImageUrls', () => {
  it('deve extrair URLs de cdn_id das páginas', () => {
    const capitulo: BritanniaCapituloDetalhado = {
      numero: '1.00',
      nome: 'Cap 1',
      paginas: [
        { numero: 2, cdn_id: 'https://cdn.imperiodabritannia.net/page2.jpg' },
        { numero: 1, cdn_id: 'https://cdn.imperiodabritannia.net/page1.jpg' },
      ],
      paywall: false,
      paywall_bloqueado: false,
      preco_moedas: null,
      capitulo_anterior: null,
      capitulo_proximo: null,
    }

    const urls = mapCapituloToImageUrls(capitulo)
    expect(urls).toEqual([
      'https://cdn.imperiodabritannia.net/page1.jpg',
      'https://cdn.imperiodabritannia.net/page2.jpg',
    ])
  })

  it('deve ordenar páginas por número', () => {
    const capitulo: BritanniaCapituloDetalhado = {
      numero: '1.00',
      nome: null,
      paginas: [
        { numero: 3, cdn_id: 'https://cdn.imperiodabritannia.net/p3.jpg' },
        { numero: 1, cdn_id: 'https://cdn.imperiodabritannia.net/p1.jpg' },
        { numero: 2, cdn_id: 'https://cdn.imperiodabritannia.net/p2.jpg' },
      ],
      paywall: false,
      paywall_bloqueado: false,
      preco_moedas: null,
      capitulo_anterior: null,
      capitulo_proximo: null,
    }

    const urls = mapCapituloToImageUrls(capitulo)
    expect(urls[0]).toContain('p1.jpg')
    expect(urls[1]).toContain('p2.jpg')
    expect(urls[2]).toContain('p3.jpg')
  })

  it('deve retornar lista vazia quando paginas é vazio', () => {
    const capitulo: BritanniaCapituloDetalhado = {
      numero: '1.00',
      nome: null,
      paginas: [],
      paywall: false,
      paywall_bloqueado: false,
      preco_moedas: null,
      capitulo_anterior: null,
      capitulo_proximo: null,
    }

    expect(mapCapituloToImageUrls(capitulo)).toEqual([])
  })

  it('deve lançar erro quando paywall_bloqueado é true', () => {
    const capitulo: BritanniaCapituloDetalhado = {
      numero: '5.00',
      nome: null,
      paginas: [],
      paywall: true,
      paywall_bloqueado: true,
      preco_moedas: 100,
      capitulo_anterior: null,
      capitulo_proximo: null,
    }

    expect(() => mapCapituloToImageUrls(capitulo)).toThrow()
  })

  it('deve incluir mensagem de preço quando disponível', () => {
    const capitulo: BritanniaCapituloDetalhado = {
      numero: '5.00',
      nome: null,
      paginas: [],
      paywall: true,
      paywall_bloqueado: true,
      preco_moedas: 100,
      capitulo_anterior: null,
      capitulo_proximo: null,
    }

    expect(() => mapCapituloToImageUrls(capitulo)).toThrow(/100/)
  })
})
