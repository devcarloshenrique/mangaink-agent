import type {
  CreateNotificationInput,
  NotificationRecord,
} from '../types/notification.types'
import type { NotificationRepository } from '../repositories/notification.repository'

/** Repo in-memory para testes do módulo de notificações. */
export class InMemoryNotificationRepository implements NotificationRepository {
  private records: NotificationRecord[] = []
  private seq = 0

  async create(input: CreateNotificationInput): Promise<NotificationRecord> {
    const record: NotificationRecord = {
      id: `notif-${++this.seq}`,
      userId: input.userId,
      type: input.type,
      title: input.title.slice(0, 200),
      message: input.message.slice(0, 500),
      metadata: input.metadata ?? null,
      readAt: null,
      createdAt: new Date().toISOString(),
    }
    this.records.unshift(record)
    return record
  }

  async findMany(userId: string, limit: number): Promise<NotificationRecord[]> {
    return this.records.filter((r) => r.userId === userId).slice(0, limit)
  }

  async countUnread(userId: string): Promise<number> {
    return this.records.filter((r) => r.userId === userId && !r.readAt).length
  }

  async markRead(id: string, userId: string): Promise<NotificationRecord | null> {
    const record = this.records.find((r) => r.id === id && r.userId === userId)
    if (!record) return null
    if (!record.readAt) record.readAt = new Date().toISOString()
    return record
  }

  async markAllRead(userId: string): Promise<number> {
    let updated = 0
    for (const r of this.records) {
      if (r.userId === userId && !r.readAt) {
        r.readAt = new Date().toISOString()
        updated++
      }
    }
    return updated
  }

  async deleteAll(userId: string): Promise<number> {
    const before = this.records.length
    this.records = this.records.filter((r) => r.userId !== userId)
    return before - this.records.length
  }

  async pruneKeepLatest(userId: string, keep: number): Promise<void> {
    const userRecords = this.records.filter((r) => r.userId === userId)
    const toRemove = userRecords.slice(keep)
    const ids = new Set(toRemove.map((r) => r.id))
    this.records = this.records.filter((r) => !ids.has(r.id))
  }

  /** Helper de teste: popula diretamente. */
  seed(record: Partial<NotificationRecord> & { userId: string }): NotificationRecord {
    this.seq++
    const full: NotificationRecord = {
      id: `notif-${this.seq}`,
      type: 'volume_ready',
      title: 't',
      message: 'm',
      metadata: null,
      readAt: null,
      createdAt: new Date().toISOString(),
      ...record,
    } as NotificationRecord
    this.records.unshift(full)
    return full
  }

  get size(): number {
    return this.records.length
  }
}
