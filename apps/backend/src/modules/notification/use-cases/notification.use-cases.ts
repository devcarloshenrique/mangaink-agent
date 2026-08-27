import type {
  NotificationListResult,
  NotificationRecord,
} from '../types/notification.types'
import type { NotificationRepository } from '../repositories/notification.repository'

const DEFAULT_LIMIT = 50

export class ListNotificationsUseCase {
  constructor(private readonly repository: NotificationRepository) {}

  async execute(input: { userId: string; limit?: number }): Promise<NotificationListResult> {
    const limit = input.limit ?? DEFAULT_LIMIT
    const [items, unreadCount] = await Promise.all([
      this.repository.findMany(input.userId, limit),
      this.repository.countUnread(input.userId),
    ])
    return { items, unreadCount }
  }
}

export class MarkNotificationReadUseCase {
  constructor(private readonly repository: NotificationRepository) {}

  async execute(input: { userId: string; id: string }): Promise<NotificationRecord | null> {
    return this.repository.markRead(input.id, input.userId)
  }
}

export class MarkAllNotificationsReadUseCase {
  constructor(private readonly repository: NotificationRepository) {}

  async execute(input: { userId: string }): Promise<{ updated: number }> {
    const updated = await this.repository.markAllRead(input.userId)
    return { updated }
  }
}
