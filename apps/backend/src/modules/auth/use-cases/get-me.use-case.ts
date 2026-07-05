import type { UserRepository } from '../../user/repositories/user.repository'
import type { PublicUser } from '../../user/entities/user.entity'
import { InvalidCredentialsError } from '../errors/auth.errors'

export class GetMeUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(userId: string): Promise<PublicUser> {
    const user = await this.userRepository.findById(userId)

    if (!user) {
      throw new InvalidCredentialsError()
    }

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      kindleEmail: user.kindleEmail,
      avatarUrl: user.avatarUrl,
    }
  }
}
