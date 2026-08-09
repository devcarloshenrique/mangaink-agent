import { describe, expect, it, vi } from 'vitest'
import { startQueueWorker } from '../queue-worker'
import { createRuntimeAdapters } from '../factory'
import type { InMemoryQueueService } from '../inmemory'

vi.mock('../../config/env', () => ({
  env: { MI_EMBEDDED_MODE: false, REDIS_URL: 'redis://localhost:6379' },
}))

vi.mock('bullmq', () => ({
  Worker: vi.fn(),
  Queue: vi.fn(),
}))

import { Worker } from 'bullmq'

describe('startQueueWorker (embedded)', () => {
  it('processa jobs FIFO via getQueue e close() encerra o loop', async () => {
    const runtime = createRuntimeAdapters({ embedded: true })
    const processed: string[] = []
    let resolveDone: (() => void) | undefined
    const done = new Promise<void>((resolve) => {
      resolveDone = resolve
    })

    const handle = startQueueWorker({
      runtime,
      queueName: 'fifo',
      concurrency: 1,
      processor: async (job) => {
        processed.push(job.data as string)
        if (processed.length === 2) resolveDone?.()
      },
    })

    const queue = runtime.getQueue('fifo') as unknown as InMemoryQueueService
    await queue.add('job', 'first')
    await queue.add('job', 'second')
    await done

    expect(processed).toEqual(['first', 'second'])

    await handle.close()

    // Após close, novos jobs não são processados
    const before = processed.length
    await queue.add('job', 'third')
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(processed).toHaveLength(before)
  })

  it('compartilha a mesma instância de fila entre produtor e worker', () => {
    const runtime = createRuntimeAdapters({ embedded: true })

    expect(runtime.getQueue('conversion-job')).toBe(runtime.getQueue('conversion-job'))
  })
})

describe('startQueueWorker (web)', () => {
  it('cria Worker BullMQ com queueName, connection url e concurrency', async () => {
    vi.mocked(Worker).mockImplementation((() => ({ on: vi.fn(), close: vi.fn() })) as never)

    const runtime = createRuntimeAdapters({ embedded: false })
    const handle = startQueueWorker({
      runtime,
      queueName: 'conversion-job',
      concurrency: 1,
      processor: async () => {},
    })

    expect(Worker).toHaveBeenCalledWith(
      'conversion-job',
      expect.any(Function),
      expect.objectContaining({
        connection: { url: 'redis://localhost:6379' },
        concurrency: 1,
      }),
    )

    await handle.close()
  })
})
