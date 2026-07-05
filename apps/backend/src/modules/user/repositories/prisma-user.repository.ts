import { prisma } from '../../../shared/database/prisma'
import type { UserRepository, CreateUserInput, UpdateUserInput } from './user.repository'

export class PrismaUserRepository implements UserRepository {
  async findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } })
  }

  async findByUsername(username: string) {
    return prisma.user.findUnique({ where: { username } })
  }

  async findByEmailOrUsername(email: string, username: string) {
    return prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
    })
  }

  async findById(id: string) {
    return prisma.user.findUnique({ where: { id } })
  }

  async create(data: CreateUserInput) {
    return prisma.user.create({ data })
  }

  async update(id: string, data: UpdateUserInput) {
    return prisma.user.update({ where: { id }, data })
  }
}
