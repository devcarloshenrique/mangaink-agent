import { describe, it, expect, beforeEach, vi } from 'vitest'
import { RegisterUserUseCase } from '../../use-cases/register.use-case'
import { UserAlreadyExistsError } from '../../errors/auth.errors'
import { InMemoryUserRepository } from '../helpers/in-memory-user.repository'
import type { PasswordHasher } from '../../services/password-hasher'
import type { TokenService } from '../../services/token.service'
import {
  JWT_ISSUER,
  JWT_AUDIENCE,
  SESSION_EXPIRES_IN,
} from '../../services/token.service'

const makeHasher = (): PasswordHasher => ({
  hash: vi.fn(async (v) => `hashed:${v}`),
  compare: vi.fn(async () => true),
})

const makeTokenService = (): TokenService => ({
  sign: vi.fn(async () => 'mocked-jwt-token'),
})

describe('RegisterUserUseCase', () => {
  let userRepository: InMemoryUserRepository
  let hasher: PasswordHasher
  let tokenService: TokenService
  let useCase: RegisterUserUseCase

  beforeEach(() => {
    userRepository = new InMemoryUserRepository()
    hasher = makeHasher()
    tokenService = makeTokenService()
    useCase = new RegisterUserUseCase(userRepository, hasher, tokenService)
  })

  it('deve criar usuário e retornar user + token com dados novos', async () => {
    const result = await useCase.execute({
      username: 'mariasantos',
      email: 'maria@example.com',
      password: 'minhasenha',
    })

    expect(result.user).toMatchObject({
      username: 'mariasantos',
      email: 'maria@example.com',
      kindleEmail: null,
      avatarUrl: null,
    })
    expect(result.user).not.toHaveProperty('passwordHash')
    expect(result.token).toBe('mocked-jwt-token')
  })

  it('deve hashear a senha antes de salvar', async () => {
    await useCase.execute({
      username: 'mariasantos',
      email: 'maria@example.com',
      password: 'minhasenha',
    })

    expect(hasher.hash).toHaveBeenCalledWith('minhasenha')

    const stored = userRepository.users[0]
    expect(stored.passwordHash).toBe('hashed:minhasenha')
  })

  it('deve lançar UserAlreadyExistsError quando e-mail já está em uso', async () => {
    await userRepository.create({
      username: 'outro',
      email: 'maria@example.com',
      passwordHash: 'hashed:abc',
    })

    await expect(
      useCase.execute({
        username: 'mariasantos',
        email: 'maria@example.com',
        password: 'senha',
      }),
    ).rejects.toThrow(UserAlreadyExistsError)
  })

  it('deve lançar UserAlreadyExistsError quando username já está em uso', async () => {
    await userRepository.create({
      username: 'mariasantos',
      email: 'outro@example.com',
      passwordHash: 'hashed:abc',
    })

    await expect(
      useCase.execute({
        username: 'mariasantos',
        email: 'maria@example.com',
        password: 'senha',
      }),
    ).rejects.toThrow(UserAlreadyExistsError)
  })

  it('deve assinar o token com sub, jti, iss, aud e expiração curta', async () => {
    const result = await useCase.execute({
      username: 'mariasantos',
      email: 'maria@example.com',
      password: 'minhasenha',
    })

    expect(tokenService.sign).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: result.user.id,
        jti: expect.any(String),
        iss: JWT_ISSUER,
        aud: JWT_AUDIENCE,
      }),
      { expiresIn: SESSION_EXPIRES_IN },
    )
  })
})
