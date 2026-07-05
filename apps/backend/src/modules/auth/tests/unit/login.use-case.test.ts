import { describe, it, expect, beforeEach, vi } from 'vitest'
import { LoginUserUseCase } from '../../use-cases/login.use-case'
import { InvalidCredentialsError } from '../../errors/auth.errors'
import { InMemoryUserRepository } from '../helpers/in-memory-user.repository'
import type { PasswordHasher } from '../../services/password-hasher'
import type { TokenService } from '../../services/token.service'

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
      email: 'john@example.com',
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
      useCase.execute({ email: 'naoexiste@example.com', password: 'senha' }),
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
      ucInvalid.execute({ email: 'john@example.com', password: 'errada' }),
    ).rejects.toThrow(InvalidCredentialsError)
  })

  it('deve assinar o token com o sub correto (userId)', async () => {
    const created = await userRepository.create({
      username: 'johndoe',
      email: 'john@example.com',
      passwordHash: 'hashed:senha',
    })

    await useCase.execute({ email: 'john@example.com', password: 'senha' })

    expect(tokenService.sign).toHaveBeenCalledWith(
      { sub: created.id },
      { expiresIn: '7d' },
    )
  })
})
