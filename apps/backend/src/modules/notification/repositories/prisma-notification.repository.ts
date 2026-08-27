import type { Notification } from '@prisma/client'
import { Prisma } from '@prisma/client'
import { getPrisma } from '../../../shared/database/prisma'
import type {
  CreateNotificationInput,
  NotificationMetadata,
  NotificationRecord,
} from '../types/notification.types'
import type { NotificationRepository } from './notification.repository'

function toRecord(row: Notification): NotificationRecord {
  return {
    id: row.id,
    userId: row.userId,
    type: row.type as NotificationRecord['type'],
    title: row.title,
    message: row.message,
    metadata: (row.metadata as NotificationMetadata | null) ?? null,
    readAt: row.readAt ? row.readAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  }
}

export class PrismaNotificationRepository implements NotificationRepository {
  async create(input: CreateNotificationInput): Promise<NotificationRecord> {
    const row = await getPrisma().notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title.slice(0, 200),
        message: input.message.slice(0, 500),
        metadata:
          input.metadata === undefined || input.metadata === null
            ? Prisma.DbNull
            : (input.metadata as unknown as Prisma.InputJsonValue),
      },
    })
    return toRecord(row)
  }

  async findMany(userId: string, limit: number): Promise<NotificationRecord[]> {
    const rows = await getPrisma().notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 100),
    })
    return rows.map(toRecord)
  }

  async countUnread(userId: string): Promise<number> {
    return getPrisma().notification.count({
      where: { userId, readAt: null },
    })
  }

  async markRead(id: string, userId: string): Promise<NotificationRecord | null> {
    const existing = await getPrisma().notification.findFirst({
      where: { id, userId },
    })
    if (!existing) return null
    if (existing.readAt) return toRecord(existing)
    const updated = await getPrisma().notification.update({
      where: { id: existing.id },
      data: { readAt: new Date() },
    })
    return toRecord(updated)
  }

  async markAllRead(userId: string): Promise<number> {
    const result = await getPrisma().notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    })
    return result.count
  }

  async deleteAll(userId: string): Promise<number> {
    const result = await getPrisma().notification.deleteMany({
      where: { userId },
    })
    return result.count
  }

  async pruneKeepLatest(userId: string, keep: number): Promise<void> {
    const cutoff = await getPrisma().notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: keep - 1,
      take: 1,
      select: { createdAt: true },
    })
    if (cutoff.length === 0) return
    await getPrisma().notification.deleteMany({
      where: { userId, createdAt: { lt: cutoff[0].createdAt } },
    })
  }
}
