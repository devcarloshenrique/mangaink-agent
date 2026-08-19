import type { FastifyReply, FastifyRequest } from 'fastify'
import type { LoginDTO } from '../dtos/login.dto'
import { LoginUserUseCase } from '../use-cases/login.use-case'
import { InvalidCredentialsError } from '../errors/auth.errors'
import { BcryptPasswordHasher } from '../services/password-hasher'
import { JwtTokenService } from '../services/token.service'
import { setAuthCookie } from '../services/auth-cookie'
import { PrismaUserRepository } from '../../user/repositories/prisma-user.repository'

export async function login(
  request: FastifyRequest<{ Body: LoginDTO }>,
  reply: FastifyReply,
) {
  const userRepository = new PrismaUserRepository()
  const hasher = new BcryptPasswordHasher()
  const tokenService = new JwtTokenService((payload, options) =>
    reply.jwtSign(payload, options),
  )

  const useCase = new LoginUserUseCase(userRepository, hasher, tokenService)

  try {
    const result = await useCase.execute(request.body)
    setAuthCookie(reply, result.token)
    return reply.send(result)
  } catch (error) {
    if (error instanceof InvalidCredentialsError) {
      return reply.code(401).send({ error: error.message })
    }
    throw error
  }
}
