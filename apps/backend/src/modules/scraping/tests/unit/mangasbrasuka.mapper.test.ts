import { describe, expect, it } from 'vitest'
import {
  resolveStatus,
  normalizeChapterNumber,
  getMangaSlug,
  getWorkType,
  parseChapterUrl,
  mapObraToInspectResponse,
  mapPaginasToImageUrls,
  buildProviderInfo,
} from '../../providers/mangasbrasuka/mangasbrasuka.mapper'
import type {
  BrasukaObra,
  BrasukaCapitulo,
} from '../../providers/mangasbrasuka/mangasbrasuka.types'

// ─── resolveStatus ──────────────────────────────────────────────────────────

describe('resolveStatus', () => {
  it('deve retornar "ongoing" para "ongoing"', () => {
    expect(resolveStatus('ongoing')).toBe('ongoing')
  })

  it('deve retornar "completed" para "completed"', () => {
    expect(resolveStatus('completed')).toBe('completed')
  })

  it('deve retornar "hiatus" para "hiatus"', () => {
    expect(resolveStatus('hiatus')).toBe('hiatus')
  })

  it('deve retornar "cancelled" para "cancelled"', () => {
    expect(resolveStatus('cancelled')).toBe('cancelled')
  })

  it('deve retornar "unknown" para null', () => {
    expect(resolveStatus(null)).toBe('unknown')
  })

  it('deve retornar "unknown" para string não reconhecida', () => {
    expect(resolveStatus('algo-estranho')).toBe('unknown')
  })
})

// ─── normalizeChapterNumber ─────────────────────────────────────────────────

describe('normalizeChapterNumber', () => {
  it('deve converter 121 para "121"', () => {
    expect(normalizeChapterNumber(121)).toBe('121')
  })

  it('deve converter 76.5 para "76.5"', () => {
    expect(normalizeChapterNumber(76.5)).toBe('76.5')
  })

  it('deve manter "76.5" como "76.5"', () => {
    expect(normalizeChapterNumber('76.5')).toBe('76.5')
  })
})

// ─── getMangaSlug / getWorkType ─────────────────────────────────────────────

describe('getMangaSlug', () => {
  it('deve extrair slug de URL válida', () => {
    expect(
      getMangaSlug('https://mangasbrasuka.com.br/manga/mushoku-tensei-jobless-reincarnation'),
    ).toBe('mushoku-tensei-jobless-reincarnation')
  })

  it('deve extrair slug de URL com barra final', () => {
    expect(getMangaSlug('https://mangasbrasuka.com.br/manhwa/o-comeco-depois-do-fim/')).toBe(
      'o-comeco-depois-do-fim',
    )
  })

  it('deve retornar "unknown" para URL sem slug', () => {
    expect(getMangaSlug('https://mangasbrasuka.com.br/')).toBe('unknown')
  })
})

describe('getWorkType', () => {
  it('deve retornar "manga" para URL de manga', () => {
    expect(getWorkType('https://mangasbrasuka.com.br/manga/meu-manga/')).toBe('manga')
  })

  it('deve retornar "manhwa" para URL de manhwa', () => {
    expect(getWorkType('https://mangasbrasuka.com.br/manhwa/meu-manga/')).toBe('manhwa')
  })
})

// ─── parseChapterUrl ────────────────────────────────────────────────────────

describe('parseChapterUrl', () => {
  it('deve extrair tipo, slug e número de URL de capítulo', () => {
    const result = parseChapterUrl(
      'https://mangasbrasuka.com.br/manga/mushoku-tensei-jobless-reincarnation/121',
    )
    expect(result).toEqual({
      type: 'manga',
      slug: 'mushoku-tensei-jobless-reincarnation',
      number: '121',
    })
  })

  it('deve tratar números decimais', () => {
    const result = parseChapterUrl('https://mangasbrasuka.com.br/manga/meu-manga/76.5')
    expect(result?.number).toBe('76.5')
  })

  it('deve retornar null para URL inválida', () => {
    expect(parseChapterUrl('https://example.com/manga/test/1')).toBeNull()
  })

  it('deve retornar null para URL sem capítulo', () => {
    expect(parseChapterUrl('https://mangasbrasuka.com.br/manga/meu-manga')).toBeNull()
  })
})

// ─── mapObraToInspectResponse ───────────────────────────────────────────────

describe('mapObraToInspectResponse', () => {
  const obra: BrasukaObra = {
    id: 'wrk_1777388316212',
    slug: 'mushoku-tensei-jobless-reincarnation',
    title: 'Mushoku Tensei: Jobless Reincarnation',
    altTitles: ['無職転生 ～異世界行ったら本気だす～'],
    author: 'Rifujin na Magonote, Sirotaka',
    publisher: null,
    coverUrl:
      'https://cdn.mugiverso.com/manga/mushoku-tensei-jobless-reincarnation/cover/cover.webp',
    backgroundUrl: null,
    description: 'Um NEET reencarna em um mundo de magia.',
    descriptionEn: '',
    tags: ['Fantasia', 'Isekai'],
    type: 'manga',
    status: 'published',
    publicationStatus: 'ongoing',
    chapterCount: 130,
    isAdult: false,
    availabilitySummary: {
      hasFreeChapters: true,
      hasPremiumChapters: false,
    },
  }

  const capitulos: BrasukaCapitulo[] = [
    {
      id: 'chp_1',
      number: 121,
      title: 'Capítulo 121',
      publishedAt: '2026-07-09T17:11:39.773Z',
      access: 'free',
      isFree: true,
      isPremium: false,
      isLocked: false,
      kind: 'chapter',
      isPreview: false,
    },
    {
      id: 'chp_2',
      number: 76.5,
      title: 'Capitulo 76.5',
      publishedAt: '2026-04-28T16:05:44.206Z',
      access: 'free',
      isFree: true,
      isPremium: false,
      isLocked: false,
      kind: 'chapter',
      isPreview: false,
    },
  ]

  const slug = 'mushoku-tensei-jobless-reincarnation'
  const canonicalUrl = 'https://mangasbrasuka.com.br/manga/mushoku-tensei-jobless-reincarnation/'

  it('deve mapear obra completa para SourceInspectResponse', () => {
    const result = mapObraToInspectResponse(obra, capitulos, slug, canonicalUrl)

    expect(result.status).toBe('ready')
    expect(result.metadata.title).toBe('Mushoku Tensei: Jobless Reincarnation')
    expect(result.metadata.description).toBe('Um NEET reencarna em um mundo de magia.')
    expect(result.metadata.genres).toEqual(['Fantasia', 'Isekai'])
    expect(result.metadata.status).toBe('ongoing')
    expect(result.chapters).toHaveLength(2)
    expect(result.covers).toHaveLength(1)
  })

  it('deve gerar sourceId determinístico', () => {
    const r1 = mapObraToInspectResponse(obra, capitulos, slug, canonicalUrl)
    const r2 = mapObraToInspectResponse(obra, capitulos, slug, canonicalUrl)
    expect(r1.sourceId).toBe(r2.sourceId)
    expect(r1.sourceId).toMatch(/^src-/)
  })

  it('deve construir URL de capa a partir do coverUrl', () => {
    const result = mapObraToInspectResponse(obra, capitulos, slug, canonicalUrl)
    expect(result.covers[0].imageUrl).toBe(
      'https://cdn.mugiverso.com/manga/mushoku-tensei-jobless-reincarnation/cover/cover.webp',
    )
  })

  it('deve retornar covers vazio quando obra não tem capa', () => {
    const semCapa = { ...obra, coverUrl: null }
    const result = mapObraToInspectResponse(semCapa, capitulos, slug, canonicalUrl)
    expect(result.covers).toEqual([])
  })

  it('deve ordenar capítulos crescente por número', () => {
    const result = mapObraToInspectResponse(obra, capitulos, slug, canonicalUrl)
    const numbers = result.chapters.map((c) => c.number)
    expect(numbers).toEqual(['76.5', '121'])
  })

  it('deve gerar chapterIds com padding correto', () => {
    const result = mapObraToInspectResponse(obra, capitulos, slug, canonicalUrl)
    const ids = result.chapters.map((c) => c.id)
    expect(ids).toEqual(['chap_0076_5', 'chap_0121'])
  })

  it('deve construir URLs de capítulo com tipo, slug e número', () => {
    const result = mapObraToInspectResponse(obra, capitulos, slug, canonicalUrl)
    expect(result.chapters[1].url).toBe(
      'https://mangasbrasuka.com.br/manga/mushoku-tensei-jobless-reincarnation/121',
    )
    expect(result.chapters[0].url).toBe(
      'https://mangasbrasuka.com.br/manga/mushoku-tensei-jobless-reincarnation/76.5',
    )
  })

  it('deve tratar campos nulos (descrição, tags, capítulos)', () => {
    const obraMinima: BrasukaObra = {
      ...obra,
      title: 'Teste',
      description: null,
      author: null,
      tags: [],
      coverUrl: null,
    }
    const result = mapObraToInspectResponse(obraMinima, [], 'teste', canonicalUrl)
    expect(result.metadata.description).toBeNull()
    expect(result.metadata.genres).toEqual([])
    expect(result.chapters).toEqual([])
    expect(result.covers).toEqual([])
    expect(result.statistics.chapters).toBe(0)
  })

  it('deve incluir provider info com engine "api"', () => {
    const result = mapObraToInspectResponse(obra, capitulos, slug, canonicalUrl)
    expect(result.provider.engine).toBe('api')
    expect(result.provider.slug).toBe('mangasbrasuka')
    expect(result.provider.name).toBe('Mangas Brasukas')
  })

  it('deve incluir source info com URL e language pt-BR', () => {
    const result = mapObraToInspectResponse(obra, capitulos, slug, canonicalUrl)
    expect(result.source.url).toBe(canonicalUrl)
    expect(result.source.language).toBe('pt-BR')
  })
})

// ─── mapPaginasToImageUrls ──────────────────────────────────────────────────

describe('mapPaginasToImageUrls', () => {
  it('deve extrair URLs ordenadas por index', () => {
    const paginas = [
      {
        index: 2,
        imageUrl: 'https://cdn.mugiverso.com/p2.webp',
        width: 0,
        height: 0,
        isDouble: false,
      },
      {
        index: 1,
        imageUrl: 'https://cdn.mugiverso.com/p1.webp',
        width: 0,
        height: 0,
        isDouble: false,
      },
    ]
    const urls = mapPaginasToImageUrls(paginas)
    expect(urls).toEqual(['https://cdn.mugiverso.com/p1.webp', 'https://cdn.mugiverso.com/p2.webp'])
  })

  it('deve retornar lista vazia quando paginas é vazio', () => {
    expect(mapPaginasToImageUrls([])).toEqual([])
  })
})

// ─── buildProviderInfo ──────────────────────────────────────────────────────

describe('buildProviderInfo', () => {
  it('deve retornar ProviderInfo correto', () => {
    const info = buildProviderInfo()
    expect(info.slug).toBe('mangasbrasuka')
    expect(info.name).toBe('Mangas Brasukas')
    expect(info.engine).toBe('api')
  })
})
