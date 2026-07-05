import { vi } from 'vitest'
import type { InMemoryUserRepository } from './in-memory-user.repository'

/**
 * Configura os mocks do PrismaUserRepository para usar o repositório in-memory.
 * Deve ser chamado antes do import do createServer.
 *
 * Uso:
 *   const repo = new InMemoryUserRepository()
 *   mockPrismaRepository(repo)
 *   const { createServer } = await import('../../../../shared/server')
 */
export function mockPrismaRepository(repo: InMemoryUserRepository) {
  vi.mock('../../user/repositories/prisma-user.repository', () => ({
    PrismaUserRepository: vi.fn().mockImplementation(() => repo),
  }))
}
