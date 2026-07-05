export type User = {
  id: string
  username: string
  email: string
  passwordHash: string
  kindleEmail: string | null
  avatarUrl: string | null
}

export type PublicUser = Omit<User, 'passwordHash'>
