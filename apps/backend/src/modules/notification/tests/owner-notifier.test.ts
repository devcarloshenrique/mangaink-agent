import { describe, it, expect, vi } from 'vitest'
import { createOwnerNotifier } from '../services/owner-notifier'
import type { NotificationService } from '../services/notification.service'
import type { ConversionRepository } from '../../conversion/repositories/conversion.repository'

function makeConversions(state?: {
  userId?: string
  status?: string
}): Pick<ConversionRepository, 'findById'> {
  return {
    findById: vi.fn(async () =>
      state
        ? ({
            config: { userId: state.userId ?? 'user-1' },
            status: state.status ?? 'processing',
          }) as never
        : null,
    ),
  }
}

function makeNotifications() {
  return { notify: vi.fn(async () => ({})) } as unknown as NotificationService
}

describe('createOwnerNotifier', () => {
  const conversionId = 'conv-1'
  const jobId = 'job-1'
  const input = {
    type: 'volume_ready' as const,
    title: 't',
    message: 'm',
    metadata: { bookTitle: 'Obra' },
  }

  it('emite notificação com userId do config e injeta conversionId/jobId no metadata', async () => {
    const notifications = makeNotifications()
    const notify = createOwnerNotifier(makeConversions({ userId: 'user-9' }), notifications)

    await notify(conversionId, jobId, () => input)

    expect(notifications.notify).toHaveBeenCalledWith('user-9', {
      type: 'volume_ready',
      title: 't',
      message: 'm',
      // conversionId/jobId entram automaticamente; os do builder vêm depois,
      // mas não sobrescrevem os ids da conversão.
      metadata: { conversionId, jobId, bookTitle: 'Obra' },
    })
  })

  it('SUPRIME notificação quando a conversão foi cancelada pelo usuário', async () => {
    const notifications = makeNotifications()
    const conversions = makeConversions({ userId: 'user-1', status: 'cancelled' })
    const build = vi.fn(() => input)
    const notify = createOwnerNotifier(conversions, notifications)

    await notify(conversionId, jobId, build)

    // Nem chega ao builder — cancelamento é decisão do próprio usuário.
    expect(build).not.toHaveBeenCalled()
    expect(notifications.notify).not.toHaveBeenCalled()
  })

  it('suprime quando o builder retorna null', async () => {
    const notifications = makeNotifications()
    const notify = createOwnerNotifier(makeConversions({ userId: 'user-1' }), notifications)

    await notify(conversionId, jobId, () => null)

    expect(notifications.notify).not.toHaveBeenCalled()
  })

  it('é no-op sem NotificationService (retrocompatibilidade de testes)', async () => {
    const conversions = makeConversions({ userId: 'user-1' })
    const notify = createOwnerNotifier(conversions, undefined)
    const build = vi.fn(() => input)

    await expect(notify(conversionId, jobId, build)).resolves.toBeUndefined()
    expect(conversions.findById).not.toHaveBeenCalled()
    expect(build).not.toHaveBeenCalled()
  })

  it('não emite quando a conversão não existe ou está sem userId', async () => {
    const notifications = makeNotifications()

    await createOwnerNotifier(makeConversions(), notifications)(conversionId, jobId, () => input)
    await createOwnerNotifier(
      makeConversions({ userId: '' }),
      notifications,
    )(conversionId, jobId, () => input)

    expect(notifications.notify).not.toHaveBeenCalled()
  })

  it('engole erros do repositório e do notify (best-effort)', async () => {
    const failingRepo: Pick<ConversionRepository, 'findById'> = {
      findById: vi.fn(async () => {
        throw new Error('db down')
      }),
    }
    await expect(
      createOwnerNotifier(failingRepo, makeNotifications())(conversionId, jobId, () => input),
    ).resolves.toBeUndefined()

    const exploding = { notify: vi.fn(async () => {
      throw new Error('redis down')
    }) } as unknown as NotificationService
    await expect(
      createOwnerNotifier(makeConversions({ userId: 'user-1' }), exploding)(
        conversionId,
        jobId,
        () => input,
      ),
    ).resolves.toBeUndefined()
  })
})
