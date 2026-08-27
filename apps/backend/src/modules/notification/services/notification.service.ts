import type { IPubSub } from '../../../shared/infra'
import { RedisPubSubAdapter } from '../../../shared/infra/redis'
import type { RuntimeAdapters } from '../../../shared/infra/factory'
import type {
  CreateNotificationInput,
  NotificationRecord,
} from '../types/notification.types'
import type { NotificationRepository } from '../repositories/notification.repository'

export const USER_NOTIFICATIONS_CHANNEL = 'user-notifications'

/** Limite de retenção por usuário (Fase de decisão: últimas 100). */
export const NOTIFICATION_RETENTION_LIMIT = 100

/**
 * Serviço central de emissão de notificações.
 *
 * `notify()` é fire-and-forget seguro para workers: persiste a notificação,
 * aplica a retenção (mantém as N mais recentes) e publica no canal
 * `user-notifications:{userId}` via `IPubSub` — que no modo web usa Redis e
 * no embedded usa in-memory, então funciona nos dois runtimes sem adaptação.
 */
export class NotificationService {
  constructor(
    private readonly repository: NotificationRepository,
    private readonly pubsub: IPubSub,
    private readonly retentionLimit = NOTIFICATION_RETENTION_LIMIT,
  ) {}

  async notify(
    userId: string,
    input: Omit<CreateNotificationInput, 'userId'>,
  ): Promise<NotificationRecord> {
    const record = await this.repository.create({ ...input, userId })

    // Retenção e broadcast não devem falhar a operação principal do worker.
    // Prune é fire-and-forget: o hot path do worker não paga 2 queries extra
    // por notificação; o limite pode ser excedido transitóriamente em 1.
    void this.repository.pruneKeepLatest(userId, this.retentionLimit).catch(() => {})
    await this.pubsub
      .publish(`${USER_NOTIFICATIONS_CHANNEL}:${userId}`, record)
      .catch(() => {})

    return record
  }
}

/**
 * Factory usada por controllers/workers. Com `runtime`, reaproveita o Pub/Sub
 * compartilhado (in-memory no embedded). Sem runtime, usa o adapter Redis web
 * default — comportamento preservado dos demais módulos.
 */
export function createNotificationService(
  repository: NotificationRepository,
  runtime?: RuntimeAdapters,
): NotificationService {
  const pubsub = runtime ? runtime.pubsub : new RedisPubSubAdapter()
  return new NotificationService(repository, pubsub)
}
