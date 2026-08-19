export type SourceInspectStatus = 'processing' | 'ready' | 'failed'

export interface SourceInfo {
  url: string
  language: string | null
}

export interface MangaMetadata {
  title: string
  author: string | null
  description: string | null
  status: string | null
  genres: string[]
}

export interface Chapter {
  id: string
  number: string
  title: string
  url: string
  pages: number | null
  volume: number | null
  isDownloaded: boolean
  isRead: boolean
}

export type CoverType = 'original' | 'gallery' | 'upload'

export interface Cover {
  id: string
  type: CoverType
  label: string
  imageUrl: string
}

export interface Statistics {
  chapters: number
  covers: number
}

export interface SourceInspectResponse {
  sourceId: string
  status: 'ready'
  provider: import('./provider.types').ProviderInfo
  source: SourceInfo
  metadata: MangaMetadata
  chapters: Chapter[]
  covers: Cover[]
  statistics: Statistics
}

export interface SourceInspectState {
  sourceId: string
  status: SourceInspectStatus
}

export interface SourceInspectJob {
  sourceId: string
  provider: string
  url: string
  refresh: boolean
  userId: string
}

export interface ChapterImagesResult {
  chapterId: string
  chapterUrl: string
  imageUrls: string[]
}
