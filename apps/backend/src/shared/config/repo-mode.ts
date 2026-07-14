import { env } from './env'

export const REPO_BACKEND = env.REPO_BACKEND

export type RepoBackend = typeof REPO_BACKEND

export function isPrismaBackend(): boolean {
  return REPO_BACKEND === 'prisma'
}
