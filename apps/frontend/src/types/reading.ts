export interface ReadingProgress {
  sourceId: string;
  readChapterIds: string[];
  totalRead: number;
  totalChapters: number;
  lastReadAt: string | null;
}

export interface MarkReadResponse {
  isRead: true;
}

export interface UnmarkReadResponse {
  isRead: false;
}

export interface BatchMarkReadInput {
  chapterIds: string[];
  markAsRead: boolean;
}

export interface BatchMarkReadResponse {
  updatedCount: number;
  readChapterIds: string[];
}

export interface DeleteCacheResponse {
  deleted: boolean;
  reason?: string;
}
