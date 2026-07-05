import { describe, it, expect, beforeEach, vi } from 'vitest'
import { UpdateMeUseCase } from '../../use-cases/update-me.use-case'
import {
  InvalidCredentialsError,
  EmailAlreadyInUseError,
  UsernameAlreadyInUseError,
} from '../../errors/auth.errors'
import { InMemoryUserRepository } from '../helpers/in-memory-user.repository'
import type { PasswordHasher } from '../../services/password-hasher'

const makeHasher = (compareResult = true): PasswordHasher => ({
  hash: vi.fn(async (v) => `hashed:${v}`),
  compare: vi.fn(async () => compareResult),
})

describe('UpdateMeUseCase', () => {
  let userRepository: InMemoryUserRepository
  let hasher: PasswordHasher
  let useCase: UpdateMeUseCase
  let userId: string

  beforeEach(async () => {
    userRepository = new InMemoryUserRepository()
    hasher = makeHasher(true)
    useCase = new UpdateMeUseCase(userRepository, hasher)

    const user = await userRepository.create({
      username: 'anacarvalho',
      email: 'ana@example.com',
      passwordHash: 'hashed:senhaatual',
    })
    userId = user.id
  })

  it('deve atualizar o username sem conflito e retornar PublicUser', async () => {
    const result = await useCase.execute(userId, { username: 'ananova' })

    expect(result.username).toBe('ananova')
    expect(result).not.toHaveProperty('passwordHash')
  })

  it('deve atualizar a senha quando currentPassword está correto', async () => {
    const result = await useCase.execute(userId, {
      currentPassword: 'senhaatual',
      password: 'novasenha',
    })

    expect(hasher.hash).toHaveBeenCalledWith('novasenha')
    expect(result.email).toBe('ana@example.com')
  })

  it('deve lançar InvalidCredentialsError quando userId não existe', async () => {
    await expect(
      useCase.execute('id-invalido', { username: 'novo' }),
    ).rejects.toThrow(InvalidCredentialsError)
  })

  it('deve lançar EmailAlreadyInUseError quando e-mail já pertence a outro usuário', async () => {
    await userRepository.create({
      username: 'outro',
      email: 'outro@example.com',
      passwordHash: 'hashed:abc',
    })

    await expect(
      useCase.execute(userId, { email: 'outro@example.com' }),
    ).rejects.toThrow(EmailAlreadyInUseError)
  })

  it('deve lançar UsernameAlreadyInUseError quando username já pertence a outro usuário', async () => {
    await userRepository.create({
      username: 'usernameemuso',
      email: 'outro2@example.com',
      passwordHash: 'hashed:abc',
    })

    await expect(
      useCase.execute(userId, { username: 'usernameemuso' }),
    ).rejects.toThrow(UsernameAlreadyInUseError)
  })

  it('deve lançar InvalidCredentialsError quando currentPassword está errado ao trocar senha', async () => {
    const hasherInvalid = makeHasher(false)
    const ucInvalid = new UpdateMeUseCase(userRepository, hasherInvalid)

    await expect(
      ucInvalid.execute(userId, {
        currentPassword: 'errada',
        password: 'novasenha',
      }),
    ).rejects.toThrow(InvalidCredentialsError)
  })

  it('não deve alterar campos não fornecidos', async () => {
    await useCase.execute(userId, { username: 'ananova' })

    const user = await userRepository.findById(userId)
    expect(user?.email).toBe('ana@example.com')
  })

  it('deve aceitar mesmo e-mail do próprio usuário sem lançar erro', async () => {
    const result = await useCase.execute(userId, { email: 'ana@example.com' })
    expect(result.email).toBe('ana@example.com')
  })
})
