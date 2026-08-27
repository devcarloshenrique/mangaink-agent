import type { ConversionRepository } from '../../conversion/repositories/conversion.repository'
import type {
  NotificationMetadata,
  NotificationType,
} from '../types/notification.types'
import type { NotificationService } from './notification.service'

export interface OwnerNotificationInput {
  type: NotificationType
  title: string
  message: string
  metadata?: NotificationMetadata
}

export interface OwnerNotifierContext {
  userId: string
  /** Status agregado atual da conversion (ex.: 'cancelled' suprime o envio). */
  conversionStatus?: string
}

/**
 * Emite uma notificação de fim/falha ao dono de uma conversion
 * (best-effort — nunca derruba o job).
 *
 * - O `userId` vem do config persistido da conversion.
 * - Retornar `null` no builder SUPRIME a notificação.
 * - Conversões canceladas pelo usuário não geram notificação (nem de falha):
 * * quem pediu o cancelamento já sabe que terminou.
 * - `conversionId`/`jobId` são injetados automaticamente no metadata.
 */
export type OwnerNotifier = (
  conversionId: string,
  jobId: string,
  build: (ctx: OwnerNotifierContext) => OwnerNotificationInput | null,
) => Promise<void>

export function createOwnerNotifier(
  conversions: Pick<ConversionRepository, 'findById'>,
  notifications?: NotificationService,
): OwnerNotifier {
  return async (conversionId, jobId, build) => {
    if (!notifications) return
    try {
      const state = await conversions.findById(conversionId)
      const userId = state?.config.userId
      if (!userId) return

      // Supressão silenciosa: cancelamento é decisão do próprio usuário.
      if (state?.status === 'cancelled') return

      const input = build({ userId, conversionStatus: state?.status })
      if (!input) return

      await notifications.notify(userId, {
        ...input,
        metadata: { conversionId, jobId, ...input.metadata },
      })
    } catch {
      // silencioso: notificação é best-effort
    }
  }
}
