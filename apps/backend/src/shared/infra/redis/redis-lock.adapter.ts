import { RedisLockService } from '../../../modules/scraping/services/redis-lock.service'
import type { ILockService } from '../lock.service'

/**
 * Adaptador de {@link ILockService} sobre o {@link RedisLockService} real
 * (modo web). Não duplica a lógica de lock (SET NX EX + Lua): apenas delega.
 * A instância interna é criada somente na primeira operação (lazy) para não
 * abrir conexão Redis no load.
 */
export class RedisLockAdapter implements ILockService {
  private inner?: RedisLockService

  async acquire(key: string): Promise<boolean> {
    return this.service().acquire(key)
  }

  async release(key: string): Promise<void> {
    await this.service().release(key)
  }

  async isLocked(key: string): Promise<boolean> {
    return this.service().isLocked(key)
  }

  private service(): RedisLockService {
    if (!this.inner) {
      this.inner = new RedisLockService()
    }
    return this.inner
  }
}
