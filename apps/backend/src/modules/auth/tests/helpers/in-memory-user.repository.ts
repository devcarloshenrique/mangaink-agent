import type {
  UserRepository,
  CreateUserInput,
  UpdateUserInput,
} from '../../../user/repositories/user.repository'
import type { User } from '../../../user/entities/user.entity'

export class InMemoryUserRepository implements UserRepository {
  public users: User[] = []
  private nextId = 1

  private generateId(): string {
    return `test-user-id-${this.nextId++}`
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.users.find((u) => u.email === email) ?? null
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.users.find((u) => u.username === username) ?? null
  }

  async findByEmailOrUsername(email: string, username: string): Promise<User | null> {
    return this.users.find((u) => u.email === email || u.username === username) ?? null
  }

  async findById(id: string): Promise<User | null> {
    return this.users.find((u) => u.id === id) ?? null
  }

  async create(data: CreateUserInput): Promise<User> {
    const user: User = {
      id: this.generateId(),
      username: data.username,
      email: data.email,
      passwordHash: data.passwordHash,
      role: data.role ?? 'USER',
      kindleEmail: null,
      avatarUrl: null,
    }
    this.users.push(user)
    return user
  }

  async update(id: string, data: UpdateUserInput): Promise<User> {
    const index = this.users.findIndex((u) => u.id === id)
    if (index === -1) throw new Error(`User not found: ${id}`)

    this.users[index] = { ...this.users[index], ...data }
    return this.users[index]
  }
}
