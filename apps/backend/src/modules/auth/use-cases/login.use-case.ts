import type { LoginDTO } from '../dtos/login.dto'
import type { TokenService } from '../services/token.service'
import type { PasswordHasher } from '../services/password-hasher'
import type { UserRepository } from '../../user/repositories/user.repository'
import type { PublicUser } from '../../user/entities/user.entity'
import { InvalidCredentialsError } from '../errors/auth.errors'
import {
  JWT_ISSUER,
  JWT_AUDIENCE,
  SESSION_EXPIRES_IN,
} from '../services/token.service'
import { randomUUID } from 'node:crypto'

export class LoginUserUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly tokenService: TokenService,
  ) {}

  async execute(data: LoginDTO): Promise<{ user: PublicUser; token: string }> {
    // Tenta encontrar por e-mail (contém @) ou por username
    const isEmail = data.identifier.includes('@')
    const user = isEmail
      ? await this.userRepository.findByEmail(data.identifier)
      : await this.userRepository.findByUsername(data.identifier)

    if (!user) {
      throw new InvalidCredentialsError()
    }

    const isPasswordValid = await this.hasher.compare(data.password, user.passwordHash)

    if (!isPasswordValid) {
      throw new InvalidCredentialsError()
    }

    const token = await this.tokenService.sign(
      {
        sub: user.id,
        role: user.role,
        jti: randomUUID(),
        iss: JWT_ISSUER,
        aud: JWT_AUDIENCE,
      },
      { expiresIn: SESSION_EXPIRES_IN },
    )

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        kindleEmail: user.kindleEmail,
        avatarUrl: user.avatarUrl,
      },
      token,
    }
  }
}
