export interface ReadingProgress {
  sourceId: string
  readChapterIds: string[]
  totalRead: number
  totalChapters: number
  lastReadAt: string | null
}

export interface MarkReadResult {
  isRead: true
}

export interface UnmarkReadResult {
  isRead: false
}

export interface BatchMarkReadInput {
  chapterIds: string[]
  markAsRead: boolean
}

export interface BatchMarkReadResult {
  updatedCount: number
  readChapterIds: string[]
}
