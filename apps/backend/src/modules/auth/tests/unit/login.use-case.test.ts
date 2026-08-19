import { describe, it, expect, beforeEach, vi } from 'vitest'
import { LoginUserUseCase } from '../../use-cases/login.use-case'
import { InvalidCredentialsError } from '../../errors/auth.errors'
import { InMemoryUserRepository } from '../helpers/in-memory-user.repository'
import type { PasswordHasher } from '../../services/password-hasher'
import type { TokenService } from '../../services/token.service'
import {
  JWT_ISSUER,
  JWT_AUDIENCE,
  SESSION_EXPIRES_IN,
} from '../../services/token.service'

const makeHasher = (valid = true): PasswordHasher => ({
  hash: vi.fn(async (v) => `hashed:${v}`),
  compare: vi.fn(async () => valid),
})

const makeTokenService = (): TokenService => ({
  sign: vi.fn(async () => 'mocked-jwt-token'),
})

describe('LoginUserUseCase', () => {
  let userRepository: InMemoryUserRepository
  let hasher: PasswordHasher
  let tokenService: TokenService
  let useCase: LoginUserUseCase

  beforeEach(() => {
    userRepository = new InMemoryUserRepository()
    hasher = makeHasher(true)
    tokenService = makeTokenService()
    useCase = new LoginUserUseCase(userRepository, hasher, tokenService)
  })

  it('deve retornar user e token quando credenciais são válidas', async () => {
    await userRepository.create({
      username: 'johndoe',
      email: 'john@example.com',
      passwordHash: 'hashed:senha123',
    })

    const result = await useCase.execute({
      identifier: 'john@example.com',
      password: 'senha123',
    })

    expect(result.user).toMatchObject({
      username: 'johndoe',
      email: 'john@example.com',
      kindleEmail: null,
      avatarUrl: null,
    })
    expect(result.user).not.toHaveProperty('passwordHash')
    expect(result.token).toBe('mocked-jwt-token')
  })

  it('deve lançar InvalidCredentialsError quando o usuário não existe', async () => {
    await expect(
      useCase.execute({ identifier: 'naoexiste@example.com', password: 'senha' }),
    ).rejects.toThrow(InvalidCredentialsError)
  })

  it('deve lançar InvalidCredentialsError quando a senha está incorreta', async () => {
    await userRepository.create({
      username: 'johndoe',
      email: 'john@example.com',
      passwordHash: 'hashed:correta',
    })

    const hasherInvalid = makeHasher(false)
    const ucInvalid = new LoginUserUseCase(userRepository, hasherInvalid, tokenService)

    await expect(
      ucInvalid.execute({ identifier: 'john@example.com', password: 'errada' }),
    ).rejects.toThrow(InvalidCredentialsError)
  })

  it('deve assinar o token com sub, jti, iss, aud e expiração curta', async () => {
    const created = await userRepository.create({
      username: 'johndoe',
      email: 'john@example.com',
      passwordHash: 'hashed:senha',
    })

    await useCase.execute({ identifier: 'john@example.com', password: 'senha' })

    expect(tokenService.sign).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: created.id,
        jti: expect.any(String),
        iss: JWT_ISSUER,
        aud: JWT_AUDIENCE,
      }),
      { expiresIn: SESSION_EXPIRES_IN },
    )
  })

  it('deve fazer login com username (sem @)', async () => {
    await userRepository.create({
      username: 'johndoe',
      email: 'john@example.com',
      passwordHash: 'hashed:senha',
    })

    const result = await useCase.execute({ identifier: 'johndoe', password: 'senha' })

    expect(result.user.username).toBe('johndoe')
    expect(result.token).toBe('mocked-jwt-token')
  })

  it('deve lançar InvalidCredentialsError ao buscar por username inexistente', async () => {
    await expect(
      useCase.execute({ identifier: 'naoexiste', password: 'senha' }),
    ).rejects.toThrow(InvalidCredentialsError)
  })
})
