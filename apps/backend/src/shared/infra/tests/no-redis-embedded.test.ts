import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { InMemoryQueueService } from '../inmemory'
import { createRuntimeAdapters } from '../factory'
import { createSafeRedis } from '../../redis/safe-redis'

vi.mock('../../config/env', () => ({
  env: { MI_EMBEDDED_MODE: false, REDIS_URL: 'redis://localhost:6379' },
}))

vi.mock('../../redis/safe-redis', () => ({
  createSafeRedis: vi.fn(),
}))

vi.mock('../../redis/bullmq', () => ({
  createQueue: vi.fn(),
}))

/**
 * Redis falso que registra chamadas no spy e lança em QUALQUER método chamado.
 * Se o runtime embedded tentar usar Redis, o teste falha ruidosamente.
 */
function createThrowingRedis(): never {
  return new Proxy(
    {},
    {
      get(_target, prop) {
        return () => {
          throw new Error(
            `[no-redis-embedded] Redis usado indevidamente em modo embedded (propriedade: ${String(prop)})`,
          )
        }
      },
    },
  ) as never
}

beforeEach(() => {
  vi.mocked(createSafeRedis).mockReset()
  vi.mocked(createSafeRedis).mockImplementation(createThrowingRedis)
})

describe('no-redis-embedded: modo embedded não cria conexão Redis', () => {
  it('embedded=true: toda a superfície dos adaptadores roda sem tocar em Redis', async () => {
    const adapters = createRuntimeAdapters({ embedded: true })

    const queue = adapters.queue as unknown as InMemoryQueueService
    const job = await queue.add('job', { x: 1 }, { jobId: 'j1' })
    expect(job.id).toBe('j1')
    await queue.process(async () => {})
    expect(await queue.getJob('j1')).not.toBeNull()
    await queue.removeJob('j1')
    await queue.close()

    const received: unknown[] = []
    const handle = await adapters.pubsub.subscribe('ch', (msg) => received.push(msg))
    await adapters.pubsub.publish('ch', { ok: true })
    expect(received).toEqual([{ ok: true }])
    await handle.unsubscribe()

    await adapters.journal.append('k', { a: 1 })
    expect(await adapters.journal.range('k', 0, -1)).toEqual(['{"a":1}'])
    expect(await adapters.journal.nextId('k')).toBe(1)
    await adapters.journal.expire('k', 60)

    await adapters.status.set('s', { status: 'running' }, 60)
    expect(await adapters.status.get('s')).toEqual({ status: 'running' })
    await adapters.status.clear('s')
    expect(await adapters.status.get('s')).toBeNull()

    expect(await adapters.lock.acquire('src-1')).toBe(true)
    expect(await adapters.lock.isLocked('src-1')).toBe(true)
    await adapters.lock.release('src-1')
    expect(await adapters.lock.isLocked('src-1')).toBe(false)

    expect(vi.mocked(createSafeRedis)).not.toHaveBeenCalled()
  })

  it('contraste: embedded=false cria conexão Redis na primeira operação (prova que o spy funciona)', async () => {
    const adapters = createRuntimeAdapters({ embedded: false })

    await expect(adapters.pubsub.subscribe('ch', () => {})).rejects.toThrow(
      /Redis usado indevidamente em modo embedded/,
    )

    expect(vi.mocked(createSafeRedis)).toHaveBeenCalled()
  })
})
