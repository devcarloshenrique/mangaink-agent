import type { NotificationRepository } from '../repositories/notification.repository'

export class ClearNotificationsUseCase {
  constructor(private readonly repository: NotificationRepository) {}

  async execute(input: { userId: string }): Promise<{ deleted: number }> {
    const deleted = await this.repository.deleteAll(input.userId)
    return { deleted }
  }
}
