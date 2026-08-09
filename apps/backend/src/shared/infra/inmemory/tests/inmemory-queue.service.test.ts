import { describe, expect, it, vi, afterEach } from 'vitest'
import { InMemoryQueueService } from '../inmemory-queue.service'

afterEach(() => {
  vi.useRealTimers()
})

describe('InMemoryQueueService', () => {
  it('add com opts.jobId → getJob devolve o job; sem jobId gera id único', async () => {
    const queue = new InMemoryQueueService<{ x: number }>()

    const j1 = await queue.add('inspect', { x: 1 }, { jobId: 'custom-1' })
    expect(j1).toMatchObject({ id: 'custom-1', name: 'inspect', data: { x: 1 }, attemptsMade: 0 })

    const found = await queue.getJob('custom-1')
    expect(found).toMatchObject({ id: 'custom-1', name: 'inspect', data: { x: 1 }, attemptsMade: 0 })

    const j2 = await queue.add('inspect', { x: 2 })
    const j3 = await queue.add('inspect', { x: 3 })
    expect(j2.id).toBeTruthy()
    expect(j2.id).not.toBe('custom-1')
    expect(j3.id).not.toBe(j2.id)
    expect((await queue.getJob(j2.id))?.data).toEqual({ x: 2 })
  })

  it('processa em ordem FIFO com concurrency 1', async () => {
    const queue = new InMemoryQueueService<number>()
    const order: number[] = []

    await queue.process(async (job) => {
      order.push(job.data)
    })

    await queue.add('t', 1, { jobId: 'a' })
    await queue.add('t', 2, { jobId: 'b' })
    await queue.add('t', 3, { jobId: 'c' })
    await queue.close()

    expect(order).toEqual([1, 2, 3])
  })

  it('concurrency 3 mantém até 3 jobs ativos simultaneamente', async () => {
    vi.useFakeTimers()
    const queue = new InMemoryQueueService<number>()
    const active = { current: 0, peak: 0 }

    await queue.process(
      async () => {
        active.current += 1
        active.peak = Math.max(active.peak, active.current)
        await new Promise<void>((resolve) => setTimeout(resolve, 10))
        active.current -= 1
      },
      { concurrency: 3 },
    )

    for (let i = 0; i < 6; i++) await queue.add('t', i)
    await vi.advanceTimersByTimeAsync(100)
    await queue.close()

    expect(active.peak).toBe(3)
  })

  it('retry com backoff exponencial: 2 falhas + sucesso conclui com attemptsMade incrementado', async () => {
    vi.useFakeTimers()
    const queue = new InMemoryQueueService<number>()
    const processor = vi.fn(async () => {
      if (processor.mock.calls.length < 3) throw new Error('falha')
    })
    const completed: string[] = []
    queue.onCompleted = (job) => completed.push(`${job.id}:${job.attemptsMade}`)

    await queue.process(processor)
    await queue.add('t', 1, { jobId: 'j1', attempts: 3, backoff: { type: 'exponential', delay: 10 } })
    await vi.advanceTimersByTimeAsync(100)
    await queue.close()

    expect(processor).toHaveBeenCalledTimes(3)
    expect(completed).toEqual(['j1:2'])
    expect(await queue.getJob('j1')).toMatchObject({ id: 'j1', attemptsMade: 2 })
  })

  it('esgotou attempts → onFailed chamado com o erro e job não é reprocessado', async () => {
    vi.useFakeTimers()
    const queue = new InMemoryQueueService<number>()
    const processor = vi.fn(async () => {
      throw new Error('sempre falha')
    })
    const failures: { jobId: string; message: string }[] = []
    queue.onFailed = (job, error) => failures.push({ jobId: job.id, message: (error as Error).message })

    await queue.process(processor)
    await queue.add('t', 1, { jobId: 'j1', attempts: 2, backoff: { type: 'exponential', delay: 5 } })
    await vi.advanceTimersByTimeAsync(50)
    await queue.close()

    expect(processor).toHaveBeenCalledTimes(2)
    expect(failures).toEqual([{ jobId: 'j1', message: 'sempre falha' }])
    expect(await queue.getJob('j1')).toMatchObject({ id: 'j1', attemptsMade: 2 })

    const callsBefore = processor.mock.calls.length
    await vi.advanceTimersByTimeAsync(1000)
    expect(processor.mock.calls.length).toBe(callsBefore)
  })

  it('opts.attempts por job sobrescreve o default (3)', async () => {
    vi.useFakeTimers()
    const queue = new InMemoryQueueService<number>()
    const processor = vi.fn(async () => {
      throw new Error('falha')
    })
    queue.onFailed = () => {}

    await queue.process(processor)
    await queue.add('t', 1, { jobId: 'single', attempts: 1 })
    await queue.add('t', 2, { jobId: 'default' })
    await vi.advanceTimersByTimeAsync(500)
    await queue.close()

    expect(processor).toHaveBeenCalledTimes(4)
  })

  it('removeJob antes do processamento → job não é processado e getJob devolve null', async () => {
    const queue = new InMemoryQueueService<number>()
    let release!: () => void
    const gate = new Promise<void>((resolve) => (release = resolve))
    const order: string[] = []

    await queue.process(async (job) => {
      order.push(job.id)
      await gate
    })

    await queue.add('t', 1, { jobId: 'keep' })
    await queue.add('t', 2, { jobId: 'removed' })
    await queue.removeJob('removed')
    expect(await queue.getJob('removed')).toBeNull()

    release()
    await queue.close()

    expect(order).toEqual(['keep'])
  })

  it('removeJob em job já em voo não interrompe o processamento', async () => {
    const queue = new InMemoryQueueService<number>()
    let release!: () => void
    const gate = new Promise<void>((resolve) => (release = resolve))
    const order: string[] = []

    await queue.process(async (job) => {
      order.push(job.id)
      await gate
    })

    await queue.add('t', 1, { jobId: 'slow' })
    await queue.add('t', 2, { jobId: 'next' })
    await queue.removeJob('slow')
    release()
    await queue.close()

    expect(order).toEqual(['slow', 'next'])
    expect(await queue.getJob('slow')).not.toBeNull()
  })

  it('retenção de completos respeita removeOnComplete.count', async () => {
    const queue = new InMemoryQueueService<number>()
    await queue.process(async () => {})

    for (let i = 0; i < 5; i++) {
      await queue.add('c', i, { jobId: `c${i}`, removeOnComplete: { count: 3 } })
    }
    await queue.close()

    expect(queue.getCompletedCount()).toBe(3)
    expect(await queue.getJob('c0')).toBeNull()
    expect(await queue.getJob('c1')).toBeNull()
    expect(await queue.getJob('c2')).not.toBeNull()
    expect(await queue.getJob('c4')).not.toBeNull()
  })

  it('retenção de falhos respeita removeOnFail.count', async () => {
    vi.useFakeTimers()
    const queue = new InMemoryQueueService<number>()
    await queue.process(async () => {
      throw new Error('falha')
    })
    queue.onFailed = () => {}

    for (let i = 0; i < 5; i++) {
      await queue.add('f', i, { jobId: `f${i}`, attempts: 1, removeOnFail: { count: 3 } })
    }
    await vi.advanceTimersByTimeAsync(10)
    await queue.close()

    expect(queue.getFailedCount()).toBe(3)
    expect(await queue.getJob('f0')).toBeNull()
    expect(await queue.getJob('f2')).not.toBeNull()
  })

  it('close() impede processamento de jobs novos, drena os antigos e é idempotente', async () => {
    const queue = new InMemoryQueueService<number>()
    const order: string[] = []

    await queue.process(async (job) => {
      order.push(job.id)
    })

    await queue.add('t', 1, { jobId: 'before' })
    await queue.close()
    await queue.close()

    await queue.add('t', 2, { jobId: 'after' })

    expect(order).toEqual(['before'])
    expect(await queue.getJob('after')).not.toBeNull()
  })

  it('jobs enfileirados antes de process() são processados quando o loop inicia', async () => {
    const queue = new InMemoryQueueService<number>()
    const order: number[] = []

    await queue.add('t', 1, { jobId: 'a' })
    await queue.add('t', 2, { jobId: 'b' })

    await queue.process(async (job) => {
      order.push(job.data)
    })
    await queue.close()

    expect(order).toEqual([1, 2])
  })
})
