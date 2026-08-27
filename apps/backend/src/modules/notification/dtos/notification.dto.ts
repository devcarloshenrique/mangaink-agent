// DTOs do módulo de notificações.
// Os schemas canônicos vivem em @mangaink/shared (usados também pelo
// frontend); aqui reexportamos e adicionamos os schemas específicos de rota.

import { z } from 'zod'
import {
  NOTIFICATION_TYPES,
  notificationSchema,
  notificationMetadataSchema,
  listNotificationsQuerySchema,
  listNotificationsResponseSchema,
  markAllReadResponseSchema,
} from '@mangaink/shared'
import type {
  NotificationType,
  NotificationDTO,
  NotificationMetadataDTO,
  ListNotificationsResponse,
} from '@mangaink/shared'

export {
  NOTIFICATION_TYPES,
  notificationSchema,
  notificationMetadataSchema,
  listNotificationsQuerySchema,
  listNotificationsResponseSchema,
  markAllReadResponseSchema,
}

export type {
  NotificationType,
  NotificationDTO,
  NotificationMetadataDTO,
  ListNotificationsResponse,
}

export const markReadParamsSchema = z.object({
  id: z.string().uuid(),
})

export type MarkReadParams = z.infer<typeof markReadParamsSchema>

export const markReadResponseSchema = notificationSchema.nullable()

export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>
