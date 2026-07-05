import type { RegisterDTO } from '../dtos/register.dto'
import type { TokenService } from '../services/token.service'
import type { PasswordHasher } from '../services/password-hasher'
import type { UserRepository } from '../../user/repositories/user.repository'
import type { PublicUser } from '../../user/entities/user.entity'
import { UserAlreadyExistsError } from '../errors/auth.errors'

export class RegisterUserUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly tokenService: TokenService,
  ) {}

  async execute(data: RegisterDTO): Promise<{ user: PublicUser; token: string }> {
    const existingUser = await this.userRepository.findByEmailOrUsername(
      data.email,
      data.username,
    )

    if (existingUser) {
      throw new UserAlreadyExistsError()
    }

    const passwordHash = await this.hasher.hash(data.password)

    const user = await this.userRepository.create({
      username: data.username,
      email: data.email,
      passwordHash,
    })

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
