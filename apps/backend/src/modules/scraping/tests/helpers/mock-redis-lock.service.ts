import type { RedisLockService } from '../../services/redis-lock.service'

export class MockRedisLockService {
  private locks = new Map<string, boolean>()

  async acquire(sourceId: string): Promise<boolean> {
    if (this.locks.get(sourceId)) return false
    this.locks.set(sourceId, true)
    return true
  }

  async release(sourceId: string): Promise<void> {
    this.locks.delete(sourceId)
  }

  async isLocked(sourceId: string): Promise<boolean> {
    return this.locks.has(sourceId)
  }

  reset(): void {
    this.locks.clear()
  }
}

export type IRedisLockService = Pick<RedisLockService, 'acquire' | 'release' | 'isLocked'>