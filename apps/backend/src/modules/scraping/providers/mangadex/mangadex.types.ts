export interface MangaDexMangaAttributes {
  title: Record<string, string>
  altTitles: Array<Record<string, string>>
  description: Record<string, string>
  status: 'ongoing' | 'completed' | 'hiatus' | 'cancelled' | string
  year?: number | null
  tags?: Array<{
    id: string
    type: string
    attributes: {
      name: Record<string, string>
    }
  }>
}

export interface MangaDexRelationship {
  id: string
  type: 'author' | 'artist' | 'cover_art' | 'manga' | string
  attributes?: {
    name?: string
    fileName?: string
    [key: string]: unknown
  }
}

export interface MangaDexMangaData {
  id: string
  type: 'manga'
  attributes: MangaDexMangaAttributes
  relationships: MangaDexRelationship[]
}

export interface MangaDexMangaResponse {
  result: string
  response: string
  data: MangaDexMangaData
}

export interface MangaDexChapterAttributes {
  volume: string | null
  chapter: string | null
  title: string | null
  translatedLanguage: string
  externalUrl: string | null
  publishAt: string
  readableAt: string
  createdAt: string
  updatedAt: string
  pages: number
  version: number
}

export interface MangaDexChapterData {
  id: string
  type: 'chapter'
  attributes: MangaDexChapterAttributes
  relationships: MangaDexRelationship[]
}

export interface MangaDexChapterListResponse {
  result: string
  response: string
  data: MangaDexChapterData[]
  limit: number
  offset: number
  total: number
}

export interface MangaDexAtHomeResponse {
  result: string
  baseUrl: string
  chapter: {
    hash: string
    data: string[]
    dataSaver: string[]
  }
}
