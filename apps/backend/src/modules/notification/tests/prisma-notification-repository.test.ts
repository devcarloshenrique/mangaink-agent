import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Prisma } from '@prisma/client'
import { PrismaNotificationRepository } from '../repositories/prisma-notification.repository'

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    notification: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}))

vi.mock('../../../shared/database/prisma', () => ({
  getPrisma: () => prismaMock,
}))

const row = (over: Partial<Record<string, unknown>> = {}) => ({
  id: '00000000-0000-4000-8000-000000000001',
  userId: '00000000-0000-4000-8000-000000000002',
  type: 'volume_ready',
  title: 't',
  message: 'm',
  metadata: null,
  readAt: null,
  createdAt: new Date('2026-08-24T12:00:00Z'),
  ...over,
})

describe('PrismaNotificationRepository', () => {
  const repo = new PrismaNotificationRepository()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('create: fatia title/message nos limites e usa DbNull para metadata ausente', async () => {
    prismaMock.notification.create.mockResolvedValue(row())

    await repo.create({
      userId: 'u',
      type: 'volume_ready',
      title: 'x'.repeat(250),
      message: 'y'.repeat(600),
    })

    expect(prismaMock.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        title: 'x'.repeat(200),
        message: 'y'.repeat(500),
        metadata: Prisma.DbNull,
      }),
    })
  })

  it('findMany: clamp de limit entre 1 e 100', async () => {
    prismaMock.notification.findMany.mockResolvedValue([])
    await repo.findMany('u', 500)
    expect(prismaMock.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 }),
    )

    await repo.findMany('u', 0)
    expect(prismaMock.notification.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ take: 1 }),
    )
  })

  it('markRead: null quando não existe/é de outro usuário; idempotente quando já lida', async () => {
    prismaMock.notification.findFirst.mockResolvedValue(null)
    expect(await repo.markRead('n1', 'user-a')).toBeNull()

    const alreadyRead = row({ readAt: new Date('2026-08-24T13:00:00Z') })
    prismaMock.notification.findFirst.mockResolvedValue(alreadyRead)
    prismaMock.notification.update.mockClear()
    const result = await repo.markRead('n1', 'user-a')
    expect(result.readAt).not.toBeNull()
    expect(prismaMock.notification.update).not.toHaveBeenCalled()

    prismaMock.notification.findFirst.mockResolvedValue(row())
    prismaMock.notification.update.mockResolvedValue(row({ readAt: new Date() }))
    await repo.markRead('n1', 'user-a')
    expect(prismaMock.notification.update).toHaveBeenCalledWith({
      where: { id: alreadyRead.id },
      data: { readAt: expect.any(Date) },
    })
  })

  it('pruneKeepLatest: no-op quando há menos que o limite; deleta apenas anteriores ao corte', async () => {
    // Menos registros que `keep` → cutoff vazio → sem delete
    prismaMock.notification.findMany.mockResolvedValue([])
    await repo.pruneKeepLatest('u', 100)
    expect(prismaMock.notification.deleteMany).not.toHaveBeenCalled()

    const cutoff = row()
    prismaMock.notification.findMany.mockResolvedValue([cutoff])
    await repo.pruneKeepLatest('u', 100)
    expect(prismaMock.notification.findMany).toHaveBeenCalledWith({
      where: { userId: 'u' },
      orderBy: { createdAt: 'desc' },
      skip: 99,
      take: 1,
      select: { createdAt: true },
    })
    expect(prismaMock.notification.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'u', createdAt: { lt: cutoff.createdAt } },
    })
  })
})
