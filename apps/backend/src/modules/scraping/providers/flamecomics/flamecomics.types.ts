/**
 * Tipos e interfaces específicos para o provider Flame Comics (flamecomics.xyz / flamecomics.me / flamecomics.com).
 */

export interface FlameComicsSeriesApiItem {
  id: number
  label: string
  status?: string | null
  image?: string | null
  chapter_count?: string | number | null
}

export interface FlameComicsSeriesData {
  series_id: number
  title: string
  altTitles?: string[] | string | null
  description?: string | null
  status?: string | null
  type?: string | null
  author?: string[] | string | null
  artist?: string[] | string | null
  tags?: string[] | null
  categories?: string[] | null
  cover?: string | null
  image?: string | null
  thumbnail?: string | null
}

export interface FlameComicsChapterData {
  chapter_id: number
  series_id: number
  chapter: string
  title?: string | null
  release_date?: number | null
  token: string
}

export interface FlameComicsChapterImageItem {
  name: string
  size?: number
  type?: string
}

export interface FlameComicsChapterDetail {
  series_id: number
  chapter_id?: number | null
  chapter?: string | null
  chapter_title?: string | null
  token: string
  images?: Record<string, FlameComicsChapterImageItem> | null
}

export interface FlameComicsSeriesPageProps {
  series?: FlameComicsSeriesData | null
  chapters?: FlameComicsChapterData[] | null
}

export interface FlameComicsBrowsePageProps {
  series?: Array<{
    series_id?: number
    id?: number
    title?: string
    label?: string
    description?: string
    type?: string
    categories?: string[]
    author?: string[]
    artist?: string[]
    status?: string
    cover?: string
    image?: string
  }> | null
}

export interface FlameComicsChapterPageProps {
  chapter?: FlameComicsChapterDetail | null
}

export interface FlameComicsNextData<T = Record<string, unknown>> {
  props?: {
    pageProps?: T
  }
}
