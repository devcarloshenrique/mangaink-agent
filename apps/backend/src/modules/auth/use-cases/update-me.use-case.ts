import type { UserRepository } from '../../user/repositories/user.repository'
import type { PasswordHasher } from '../services/password-hasher'
import type { PublicUser } from '../../user/entities/user.entity'
import {
  InvalidCredentialsError,
  EmailAlreadyInUseError,
  UsernameAlreadyInUseError,
} from '../errors/auth.errors'

export class UpdateMeUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly hasher: PasswordHasher,
  ) {}

  async execute(
    userId: string,
    data: {
      username?: string
      email?: string
      kindleEmail?: string | null
      avatarUrl?: string | null
      currentPassword?: string
      password?: string
    },
  ): Promise<PublicUser> {
    const user = await this.userRepository.findById(userId)

    if (!user) {
      throw new InvalidCredentialsError()
    }

    if (data.email && data.email !== user.email) {
      const existingEmail = await this.userRepository.findByEmail(data.email)
      if (existingEmail) throw new EmailAlreadyInUseError()
    }

    if (data.username && data.username !== user.username) {
      const existingUsername = await this.userRepository.findByUsername(data.username)
      if (existingUsername) throw new UsernameAlreadyInUseError()
    }

    let passwordHash: string | undefined
    if (data.password) {
      const isPasswordValid = await this.hasher.compare(
        data.currentPassword!,
        user.passwordHash,
      )
      if (!isPasswordValid) throw new InvalidCredentialsError()
      passwordHash = await this.hasher.hash(data.password)
    }

    const updateData: Record<string, unknown> = {}
    if (data.username !== undefined) updateData.username = data.username
    if (data.email !== undefined) updateData.email = data.email
    if (data.kindleEmail !== undefined)
      updateData.kindleEmail = data.kindleEmail === '' ? null : data.kindleEmail
    if (data.avatarUrl !== undefined) updateData.avatarUrl = data.avatarUrl
    if (passwordHash !== undefined) updateData.passwordHash = passwordHash

    const updatedUser = await this.userRepository.update(userId, updateData)

    return {
      id: updatedUser.id,
      username: updatedUser.username,
      email: updatedUser.email,
      kindleEmail: updatedUser.kindleEmail,
      avatarUrl: updatedUser.avatarUrl,
    }
  }
}
