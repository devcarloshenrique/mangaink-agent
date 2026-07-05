import type { FastifyReply, FastifyRequest } from 'fastify'
import { PrismaUserRepository } from '../../user/repositories/prisma-user.repository'
import { BcryptPasswordHasher } from '../services/password-hasher'
import { UpdateMeUseCase } from '../use-cases/update-me.use-case'
import { updateMeSchema } from '../dtos/update-me.dto'
import {
  InvalidCredentialsError,
  EmailAlreadyInUseError,
  UsernameAlreadyInUseError,
} from '../errors/auth.errors'

export async function updateMe(request: FastifyRequest, reply: FastifyReply) {
  const parsed = updateMeSchema.safeParse(request.body)

  if (!parsed.success) {
    return reply.code(400).send({
      error: parsed.error.issues[0]?.message ?? 'Dados inválidos',
      issues: parsed.error.issues,
    })
  }

  const data = parsed.data
  const userId = (request.user as { sub: string }).sub

  const userRepository = new PrismaUserRepository()
  const hasher = new BcryptPasswordHasher()
  const useCase = new UpdateMeUseCase(userRepository, hasher)

  try {
    const user = await useCase.execute(userId, {
      username: data.username,
      email: data.email,
      kindleEmail: data.kindleEmail,
      avatarUrl: data.avatarUrl,
      currentPassword: data.currentPassword,
      password: data.password,
    })
    return reply.send(user)
  } catch (err) {
    if (err instanceof InvalidCredentialsError) {
      return reply.code(401).send({ error: err.message })
    }
    if (err instanceof EmailAlreadyInUseError) {
      return reply.code(409).send({ error: err.message })
    }
    if (err instanceof UsernameAlreadyInUseError) {
      return reply.code(409).send({ error: err.message })
    }
    throw err
  }
}
