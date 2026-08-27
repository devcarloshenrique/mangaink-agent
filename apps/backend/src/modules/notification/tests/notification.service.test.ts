import { describe, it, expect, vi } from 'vitest'
import { NotificationService, NOTIFICATION_RETENTION_LIMIT } from '../services/notification.service'
import type { IPubSub } from '../../../shared/infra'
import type { NotificationRecord } from '../types/notification.types'
import { InMemoryNotificationRepository } from './inmemory-notification.repository'

function createFakePubSub() {
  const published: { channel: string; message: unknown }[] = []
  const pubsub: IPubSub = {
    publish: vi.fn(async (channel: string, message: unknown) => {
      published.push({ channel, message })
    }),
    subscribe: vi.fn(async () => ({ unsubscribe: async () => {} })),
    subscribeMany: vi.fn(async () => ({ unsubscribe: async () => {} })),
    unsubscribe: vi.fn(async () => {}),
    unsubscribeMany: vi.fn(async () => {}),
  }
  return { pubsub, published }
}

describe('NotificationService', () => {
  it('persiste e publica no canal do usuário', async () => {
    const repo = new InMemoryNotificationRepository()
    const { pubsub, published } = createFakePubSub()
    const service = new NotificationService(repo, pubsub)

    const record = await service.notify('user-1', {
      type: 'volume_ready',
      title: '"Vol. 1" pronto',
      message: 'Conversão concluída — 12.0 MB (EPUB)',
      metadata: { conversionId: 'conv-1', bookTitle: 'Vol. 1', outputSize: 12_582_912 },
    })

    expect(record.id).toBeTruthy()
    expect(record.readAt).toBeNull()
    expect(repo.size).toBe(1)
    expect(published).toHaveLength(1)
    expect(published[0].channel).toBe('user-notifications:user-1')
    // O adapter serializa; o serviço publica o objeto puro (padrão da casa).
    const payload = published[0].message as NotificationRecord
    expect(payload.type).toBe('volume_ready')
    expect(payload.metadata?.conversionId).toBe('conv-1')
  })

  it('aplica retenção de 100 registros por usuário', async () => {
    const repo = new InMemoryNotificationRepository()
    const { pubsub } = createFakePubSub()
    const service = new NotificationService(repo, pubsub)

    for (let i = 0; i < NOTIFICATION_RETENTION_LIMIT + 10; i++) {
      await service.notify('user-1', {
        type: 'volume_ready',
        title: `t-${i}`,
        message: 'm',
      })
    }

    expect(repo.size).toBe(NOTIFICATION_RETENTION_LIMIT)
  })

  it('não mistura retenção entre usuários', async () => {
    const repo = new InMemoryNotificationRepository()
    const { pubsub } = createFakePubSub()
    const service = new NotificationService(repo, pubsub)

    for (let i = 0; i < NOTIFICATION_RETENTION_LIMIT + 5; i++) {
      await service.notify('user-1', { type: 'volume_ready', title: `t-${i}`, message: 'm' })
    }
    await service.notify('user-2', { type: 'conversion_failed', title: 'falha', message: 'm' })

    expect(repo.size).toBe(NOTIFICATION_RETENTION_LIMIT + 1)
    const user2Items = await repo.findMany('user-2', 100)
    expect(user2Items).toHaveLength(1)
    expect(user2Items[0].type).toBe('conversion_failed')
  })

  it('continua funcionando mesmo se o publish falhar', async () => {
    const repo = new InMemoryNotificationRepository()
    const pubsub: IPubSub = {
      publish: vi.fn(async () => {
        throw new Error('redis down')
      }),
      subscribe: vi.fn(async () => ({ unsubscribe: async () => {} })),
      subscribeMany: vi.fn(async () => ({ unsubscribe: async () => {} })),
      unsubscribe: vi.fn(async () => {}),
      unsubscribeMany: vi.fn(async () => {}),
    }
    const service = new NotificationService(repo, pubsub)

    const record = await service.notify('user-1', {
      type: 'download_failed',
      title: 'Download falhou',
      message: 'erro',
    })

    expect(record.id).toBeTruthy()
    expect(repo.size).toBe(1)
  })
})
