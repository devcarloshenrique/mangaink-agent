import type { User } from '../entities/user.entity'

export type CreateUserInput = {
  username: string
  email: string
  passwordHash: string
}

export type UpdateUserInput = {
  username?: string
  email?: string
  passwordHash?: string
  kindleEmail?: string | null
  avatarUrl?: string | null
}

export interface UserRepository {
  findByEmail(email: string): Promise<User | null>
  findByUsername(username: string): Promise<User | null>
  findByEmailOrUsername(email: string, username: string): Promise<User | null>
  findById(id: string): Promise<User | null>
  create(data: CreateUserInput): Promise<User>
  update(id: string, data: UpdateUserInput): Promise<User>
}
