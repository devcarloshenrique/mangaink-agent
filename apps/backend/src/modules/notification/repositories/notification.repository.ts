import type {
  CreateNotificationInput,
  NotificationRecord,
} from '../types/notification.types'

/**
 * Persistência de notificações. Todas as operações são escopadas ao
 * `userId` — ownership é garantido em camada de dados, não só no controller.
 */
export interface NotificationRepository {
  create(input: CreateNotificationInput): Promise<NotificationRecord>

  /** Mais recentes primeiro (createdAt DESC). */
  findMany(userId: string, limit: number): Promise<NotificationRecord[]>

  countUnread(userId: string): Promise<number>

  /** Marca como lida; retorna null se não existir ou não pertencer ao usuário. */
  markRead(id: string, userId: string): Promise<NotificationRecord | null>

  /** Marca todas como lidas; retorna quantas foram atualizadas. */
  markAllRead(userId: string): Promise<number>

  /** Remove TODAS as notificações do usuário; retorna quantas foram excluídas. */
  deleteAll(userId: string): Promise<number>

  /** Retenção: mantém apenas os `keep` registros mais recentes do usuário. */
  pruneKeepLatest(userId: string, keep: number): Promise<void>
}
