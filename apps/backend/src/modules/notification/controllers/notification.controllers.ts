import type { FastifyReply, FastifyRequest } from 'fastify'
import { getNotificationRepository } from '../../../shared/database/repositories'
import {
  ListNotificationsUseCase,
  MarkNotificationReadUseCase,
  MarkAllNotificationsReadUseCase,
} from '../use-cases/notification.use-cases'
import type {
  ListNotificationsQuery,
  MarkReadParams,
} from '../dtos/notification.dto'

export async function listNotifications(request: FastifyRequest, reply: FastifyReply) {
  const userId = (request.user as { sub: string }).sub
  const { limit } = (request.query as ListNotificationsQuery) ?? { limit: 50 }

  const useCase = new ListNotificationsUseCase(getNotificationRepository())
  const result = await useCase.execute({ userId, limit })

  return reply.code(200).send(result)
}

export async function markNotificationRead(request: FastifyRequest, reply: FastifyReply) {
  const userId = (request.user as { sub: string }).sub
  const { id } = request.params as MarkReadParams

  const useCase = new MarkNotificationReadUseCase(getNotificationRepository())
  const record = await useCase.execute({ userId, id })

  if (!record) {
    return reply.code(404).send({ error: 'Notificação não encontrada' })
  }
  return reply.code(200).send(record)
}

export async function markAllNotificationsRead(request: FastifyRequest, reply: FastifyReply) {
  const userId = (request.user as { sub: string }).sub

  const useCase = new MarkAllNotificationsReadUseCase(getNotificationRepository())
  const result = await useCase.execute({ userId })

  return reply.code(200).send(result)
}
