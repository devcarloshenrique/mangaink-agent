import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { env } from '../config/env'

let _prisma: PrismaClient | undefined

export function getPrisma(): PrismaClient {
  if (!_prisma) {
    const adapter = new PrismaPg({ connectionString: env.DATABASE_URL })
    _prisma = new PrismaClient({ adapter })
  }
  return _prisma
}
