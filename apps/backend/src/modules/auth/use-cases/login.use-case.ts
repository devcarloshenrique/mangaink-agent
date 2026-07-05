import type { LoginDTO } from '../dtos/login.dto'
import type { TokenService } from '../services/token.service'
import type { PasswordHasher } from '../services/password-hasher'
import type { UserRepository } from '../../user/repositories/user.repository'
import type { PublicUser } from '../../user/entities/user.entity'
import { InvalidCredentialsError } from '../errors/auth.errors'

export class LoginUserUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly tokenService: TokenService,
  ) {}

  async execute(data: LoginDTO): Promise<{ user: PublicUser; token: string }> {
    const user = await this.userRepository.findByEmail(data.email)

    if (!user) {
      throw new InvalidCredentialsError()
    }

    const isPasswordValid = await this.hasher.compare(data.password, user.passwordHash)

    if (!isPasswordValid) {
      throw new InvalidCredentialsError()
    }

    const token = await this.tokenService.sign({ sub: user.id }, { expiresIn: '7d' })

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        kindleEmail: user.kindleEmail,
        avatarUrl: user.avatarUrl,
      },
      token,
    }
  }
}
