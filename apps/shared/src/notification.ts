import { z } from 'zod'

// ─── Notificações de atividades em background ──────────────────────────────────
// Contrato compartilhado entre backend (emissão/persistência) e frontend
// (centro de notificações no header). Progresso ao vivo NÃO faz parte deste
// contrato — é consumido via GET /api/conversions?status=queued,processing.

export const NOTIFICATION_TYPES = [
  'volume_ready',
  'conversion_failed',
  'conversion_cancelled',
  'download_completed',
  'download_failed',
  'chapter_cache_deleted',
] as const

export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

const failedChapterSchema = z.object({
  chapterId: z.string(),
  reason: z.string(),
})

export type FailedChapterDTO = z.infer<typeof failedChapterSchema>

export const notificationMetadataSchema = z
  .object({
    conversionId: z.string().optional(),
    jobId: z.string().optional(),
    sourceId: z.string().optional(),
    bookTitle: z.string().optional(),
    format: z.string().optional(),
    outputFile: z.string().optional(),
    outputSize: z.number().optional(),
    successfulChapters: z.number().optional(),
    totalImages: z.number().optional(),
    failedChapters: z.array(failedChapterSchema).optional(),
  })
  .nullable()

export type NotificationMetadataDTO = z.infer<typeof notificationMetadataSchema>

export const notificationSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  type: z.enum(NOTIFICATION_TYPES),
  title: z.string(),
  message: z.string(),
  metadata: notificationMetadataSchema,
  readAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
})

export type NotificationDTO = z.infer<typeof notificationSchema>

export const listNotificationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

export const listNotificationsResponseSchema = z.object({
  items: z.array(notificationSchema),
  unreadCount: z.number().int(),
})

export type ListNotificationsResponse = z.infer<typeof listNotificationsResponseSchema>

export const markAllReadResponseSchema = z.object({
  updated: z.number().int(),
})

export type MarkAllReadResponse = z.infer<typeof markAllReadResponseSchema>
