import { describe, it, expect } from 'vitest'
import { ClearNotificationsUseCase } from '../use-cases/clear-notifications.use-case'
import { InMemoryNotificationRepository } from './inmemory-notification.repository'

describe('ClearNotificationsUseCase', () => {
  it('remove todas as notificações do usuário e isola os demais', async () => {
    const repo = new InMemoryNotificationRepository()
    repo.seed({ userId: 'user-1', title: 'a' })
    repo.seed({ userId: 'user-1', title: 'b' })
    repo.seed({ userId: 'user-2', title: 'c' })

    const useCase = new ClearNotificationsUseCase(repo)
    const { deleted } = await useCase.execute({ userId: 'user-1' })

    expect(deleted).toBe(2)
    expect(repo.size).toBe(1)

    const user2 = await new (await import('../use-cases/notification.use-cases')).ListNotificationsUseCase(
      repo,
    ).execute({ userId: 'user-2' })
    expect(user2.items).toHaveLength(1)
    expect(user2.items[0].title).toBe('c')
  })

  it('retorna deleted 0 quando não há nada', async () => {
    const repo = new InMemoryNotificationRepository()
    const { deleted } = await new ClearNotificationsUseCase(repo).execute({ userId: 'user-x' })
    expect(deleted).toBe(0)
  })
})
