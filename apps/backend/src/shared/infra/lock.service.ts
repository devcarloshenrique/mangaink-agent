/**
 * Contratos de lock distribuído — API fiel ao RedisLockService real.
 * O workerId é interno (por processo/instância); o chamador não fornece token.
 */
export interface ILockService {
  acquire(key: string): Promise<boolean>
  release(key: string): Promise<void>
  isLocked(key: string): Promise<boolean>
}
