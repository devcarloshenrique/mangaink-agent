import type { FastifyReply, FastifyRequest } from 'fastify'
import { getNotificationRepository } from '../../../shared/database/repositories'
import { ClearNotificationsUseCase } from '../use-cases/clear-notifications.use-case'

export async function clearNotifications(request: FastifyRequest, reply: FastifyReply) {
  const userId = (request.user as { sub: string }).sub

  const useCase = new ClearNotificationsUseCase(getNotificationRepository())
  const result = await useCase.execute({ userId })

  return reply.code(200).send(result)
}
