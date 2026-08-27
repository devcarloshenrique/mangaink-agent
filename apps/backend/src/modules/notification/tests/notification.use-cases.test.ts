import { describe, it, expect } from 'vitest'
import {
  ListNotificationsUseCase,
  MarkNotificationReadUseCase,
  MarkAllNotificationsReadUseCase,
} from '../use-cases/notification.use-cases'
import { InMemoryNotificationRepository } from './inmemory-notification.repository'

describe('ListNotificationsUseCase', () => {
  it('retorna itens + unreadCount escopados ao usuário', async () => {
    const repo = new InMemoryNotificationRepository()
    repo.seed({ userId: 'user-1', title: 'a' })
    repo.seed({ userId: 'user-1', title: 'b' })
    repo.seed({ userId: 'user-2', title: 'c' })

    const useCase = new ListNotificationsUseCase(repo)
    const result = await useCase.execute({ userId: 'user-1' })

    expect(result.items).toHaveLength(2)
    expect(result.unreadCount).toBe(2)
  })

  it('respeita o limit e ordena do mais recente', async () => {
    const repo = new InMemoryNotificationRepository()
    for (let i = 0; i < 10; i++) {
      repo.seed({ userId: 'user-1', title: `n-${i}` })
    }

    const useCase = new ListNotificationsUseCase(repo)
    const result = await useCase.execute({ userId: 'user-1', limit: 3 })

    expect(result.items).toHaveLength(3)
    expect(result.items[0].title).toBe('n-9')
  })
})

describe('MarkNotificationReadUseCase', () => {
  it('marca como lida e é idempotente', async () => {
    const repo = new InMemoryNotificationRepository()
    const seeded = repo.seed({ userId: 'user-1' })
    const useCase = new MarkNotificationReadUseCase(repo)

    const first = await useCase.execute({ userId: 'user-1', id: seeded.id })
    expect(first?.readAt).not.toBeNull()

    const second = await useCase.execute({ userId: 'user-1', id: seeded.id })
    expect(second?.readAt).toBe(first?.readAt)

    const list = await new ListNotificationsUseCase(repo).execute({ userId: 'user-1' })
    expect(list.unreadCount).toBe(0)
  })

  it('retorna null para notificação de outro usuário (ownership)', async () => {
    const repo = new InMemoryNotificationRepository()
    const seeded = repo.seed({ userId: 'user-1' })
    const useCase = new MarkNotificationReadUseCase(repo)

    const result = await useCase.execute({ userId: 'intruder', id: seeded.id })
    expect(result).toBeNull()
  })
})

describe('MarkAllNotificationsReadUseCase', () => {
  it('marca todas as não lidas e conta apenas as atualizadas', async () => {
    const repo = new InMemoryNotificationRepository()
    repo.seed({ userId: 'user-1' })
    repo.seed({ userId: 'user-1', readAt: new Date().toISOString() })
    repo.seed({ userId: 'user-2' })

    const useCase = new MarkAllNotificationsReadUseCase(repo)
    const { updated } = await useCase.execute({ userId: 'user-1' })

    expect(updated).toBe(1)
    const list = await new ListNotificationsUseCase(repo).execute({ userId: 'user-1' })
    expect(list.unreadCount).toBe(0)
    // user-2 continua intacto
    const other = await new ListNotificationsUseCase(repo).execute({ userId: 'user-2' })
    expect(other.unreadCount).toBe(1)
  })
})
