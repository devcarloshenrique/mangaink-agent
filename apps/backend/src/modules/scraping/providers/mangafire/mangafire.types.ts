export interface MangaFirePoster {
  small?: string | null
  medium?: string | null
  large?: string | null
}

export interface MangaFireTitleSummary {
  id?: number | string
  hid: string
  slug: string
  title: string
  poster?: MangaFirePoster | null
  status?: string | null
  type?: string | null
  genres?: string[] | null
  authors?: string[] | null
  author?: string | null
  [key: string]: any
}

export interface MangaFireSearchResponse {
  total: number
  items?: MangaFireTitleSummary[]
}

export interface MangaFireTitleDetail {
  id?: number | string
  hid: string
  slug: string
  title: string
  synopsisHtml?: string | null
  description?: string | null
  poster?: MangaFirePoster | null
  status?: string | null
  type?: string | null
  genres?: string[] | null
  authors?: string[] | null
  author?: string | null
  languages?: string[] | null
  [key: string]: any
}

export interface MangaFireTitleDetailResponse {
  status?: number
  result?: string
  data?: MangaFireTitleDetail
  name?: string
  [key: string]: any
}

export interface MangaFireChapterItem {
  id: number | string
  number: number | string
  name?: string | null
  language?: string | null
  type?: string | null
  createdAt?: number | string | null
  volume?: number | string | null
  [key: string]: any
}

export interface MangaFireChapterPaginationMeta {
  total: number
  perPage: number
  page: number
  lastPage: number
  from?: number
  to?: number
  hasNext: boolean
  hasPrev: boolean
}

export interface MangaFireChapterListResponse {
  status?: number
  result?: string
  meta?: MangaFireChapterPaginationMeta
  items?: MangaFireChapterItem[]
  total?: number
  [key: string]: any
}

export interface MangaFireChapterPage {
  url: string
  offset?: number
  width?: number
  height?: number
  [key: string]: any
}

export interface MangaFireChapterPagesResponse {
  status?: number
  result?: string
  data?: {
    pages?: MangaFireChapterPage[]
    [key: string]: any
  }
  pages?: MangaFireChapterPage[]
  images?: Array<{ url: string } | string>
  [key: string]: any
}

export interface MangaFireOptions {
  baseUrl?: string
  language?: string
  timeout?: number
}
