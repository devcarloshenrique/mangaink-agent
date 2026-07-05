import { describe, it, expect, beforeEach } from 'vitest'
import { GetMeUseCase } from '../../use-cases/get-me.use-case'
import { InvalidCredentialsError } from '../../errors/auth.errors'
import { InMemoryUserRepository } from '../helpers/in-memory-user.repository'

describe('GetMeUseCase', () => {
  let userRepository: InMemoryUserRepository
  let useCase: GetMeUseCase

  beforeEach(() => {
    userRepository = new InMemoryUserRepository()
    useCase = new GetMeUseCase(userRepository)
  })

  it('deve retornar PublicUser quando o userId é válido', async () => {
    const created = await userRepository.create({
      username: 'pedrolima',
      email: 'pedro@example.com',
      passwordHash: 'hashed:abc',
    })

    const result = await useCase.execute(created.id)

    expect(result).toMatchObject({
      id: created.id,
      username: 'pedrolima',
      email: 'pedro@example.com',
      kindleEmail: null,
      avatarUrl: null,
    })
    expect(result).not.toHaveProperty('passwordHash')
  })

  it('deve lançar InvalidCredentialsError quando o userId não existe', async () => {
    await expect(useCase.execute('id-inexistente')).rejects.toThrow(
      InvalidCredentialsError,
    )
  })
})
