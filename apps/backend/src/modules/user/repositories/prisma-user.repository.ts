import { getPrisma } from '../../../shared/database/prisma'
import type { UserRepository, CreateUserInput, UpdateUserInput } from './user.repository'

export class PrismaUserRepository implements UserRepository {
  async findByEmail(email: string) {
    return getPrisma().user.findUnique({ where: { email } })
  }

  async findByUsername(username: string) {
    return getPrisma().user.findUnique({ where: { username } })
  }

  async findByEmailOrUsername(email: string, username: string) {
    return getPrisma().user.findFirst({
      where: { OR: [{ email }, { username }] },
    })
  }

  async findById(id: string) {
    return getPrisma().user.findUnique({ where: { id } })
  }

  async create(data: CreateUserInput) {
    return getPrisma().user.create({ data })
  }

  async update(id: string, data: UpdateUserInput) {
    return getPrisma().user.update({ where: { id }, data })
  }
}
