export interface MangaKakalotSearchRaw {
  title: string
  url: string
  coverUrl?: string | null
  author?: string | null
  latestChapter?: string | null
  type?: string | null
}

export interface MangaKakalotChapterRaw {
  title: string
  url: string
  chapterNumber: string
  volume: number | null
  updatedAt?: string | null
}

export interface MangaKakalotMangaRaw {
  title: string
  description?: string | null
  coverUrl?: string | null
  status?: string | null
  author?: string | null
  artist?: string | null
  genres: string[]
  chapters: MangaKakalotChapterRaw[]
}

export interface MangaKakalotApiChapter {
  id?: number | string
  chapter_name: string
  chapter_slug: string
  chapter_num?: number | string
  updated_at?: string
  view?: number
}

export interface MangaKakalotApiChaptersResponse {
  success?: boolean
  data?: {
    chapters?: MangaKakalotApiChapter[]
    pagination?: {
      total?: number
      limit?: number
      offset?: number
      has_more?: boolean
    }
  }
}
