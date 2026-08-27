// Tipos do módulo de notificações — atividades em background (fim/falha).
// Progresso ao vivo NÃO vira notificação: é consumido via GET /api/conversions?status=...

export type NotificationType =
  | 'volume_ready'
  | 'conversion_failed'
  | 'conversion_cancelled'
  | 'download_completed'
  | 'download_failed'
  | 'chapter_cache_deleted'

/** Capítulo que não pôde ser baixado (ignorado/corrompido) num download-only. */
export interface FailedChapter {
  chapterId: string
  reason: string
}

export interface NotificationMetadata {
  conversionId?: string
  jobId?: string
  sourceId?: string
  bookTitle?: string
  format?: string
  outputFile?: string
  outputSize?: number
  successfulChapters?: number
  totalImages?: number
  failedChapters?: FailedChapter[]
}

export interface CreateNotificationInput {
  userId: string
  type: NotificationType
  title: string
  message: string
  metadata?: NotificationMetadata | null
}

export interface NotificationRecord {
  id: string
  userId: string
  type: NotificationType
  title: string
  message: string
  metadata: NotificationMetadata | null
  readAt: string | null
  createdAt: string
}

export interface NotificationListResult {
  items: NotificationRecord[]
  unreadCount: number
}
