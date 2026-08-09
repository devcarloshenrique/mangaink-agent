/**
 * Tipos da API externa do Mangas Brasukas.
 *
 * Estes tipos refletem a estrutura das respostas JSON retornadas pela
 * API em app.mangasbrasuka.com.br. Não são tipos do domínio interno.
 */

// ─── Resposta de Obra (/v1/www/works/{slug}) ──────────────────────────────

export interface BrasukaObra {
  id: string
  slug: string
  title: string
  altTitles: string[]
  author: string | null
  publisher: string | null
  coverUrl: string | null
  backgroundUrl: string | null
  description: string | null
  descriptionEn: string
  tags: string[]
  type: string
  status: string
  publicationStatus: string
  chapterCount: number
  isAdult: boolean
  availabilitySummary: {
    hasFreeChapters: boolean
    hasPremiumChapters: boolean
  }
}

// ─── Resposta de Capítulos (/v1/www/works/{slug}/chapters) ────────────────

export interface BrasukaCapitulo {
  id: string
  number: number
  title: string | null
  publishedAt: string | null
  access: string
  isFree: boolean
  isPremium: boolean
  isLocked: boolean
  kind: string
  isPreview: boolean
}

// ─── Resposta de Páginas (/v1/www/works/{slug}/chapters/{n}/pages) ────────

export interface BrasukaPagina {
  index: number
  imageUrl: string
  width: number
  height: number
  isDouble: boolean
}

export interface BrasukaPaginasResponse {
  data: {
    chapterId: string
    pages: BrasukaPagina[]
  }
}
