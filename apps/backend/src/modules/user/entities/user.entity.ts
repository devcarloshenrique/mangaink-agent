export type UserRole = 'USER' | 'ADMIN'

export type User = {
  id: string
  username: string
  email: string
  passwordHash: string
  role: UserRole
  kindleEmail: string | null
  avatarUrl: string | null
}

export type PublicUser = Omit<User, 'passwordHash'>
