import { describe, expect, it } from 'vitest'
import type {
  IJournalStore,
  ILockService,
  IPubSub,
  IQueueService,
  IStatusStore,
  QueueAddOptions,
  QueueJob,
} from '../index'

describe('Contratos de infraestrutura (desacoplados de Redis/BullMQ)', () => {
  it('IQueueService expõe apenas add, getJob e removeJob', () => {
    const probeQueue = {
      async add<T>(_name: string, _data: T, _opts?: QueueAddOptions): Promise<QueueJob<T>> {
        return { id: 'id', name: _name, data: _data, attemptsMade: 0 }
      },
      async getJob<T>(jobId: string): Promise<QueueJob<T> | null> {
        return { id: jobId, name: 'job', data: {} as T, attemptsMade: 0 }
      },
      async removeJob(_jobId: string): Promise<void> {},
    }
    const probe: IQueueService = probeQueue
    expect(Object.keys(probe)).toEqual(['add', 'getJob', 'removeJob'])
  })

  it('IPubSub expõe publish, subscribe, subscribeMany, unsubscribe e unsubscribeMany', () => {
    const probePubSub = {
      async publish(_channel: string, _message: unknown): Promise<void> {},
      async subscribe(
        _channel: string,
        _callback: (message: any) => void,
      ): Promise<{ unsubscribe(): Promise<void> }> {
        return { async unsubscribe() {} }
      },
      async subscribeMany(
        _channels: string[],
        _callback: (channel: string, message: any) => void,
      ): Promise<{ unsubscribe(): Promise<void> }> {
        return { async unsubscribe() {} }
      },
      async unsubscribe(_channel: string, _callback: (message: any) => void): Promise<void> {},
      async unsubscribeMany(_channels: string[]): Promise<void> {},
    }
    const probe: IPubSub = probePubSub
    expect(Object.keys(probe)).toEqual([
      'publish',
      'subscribe',
      'subscribeMany',
      'unsubscribe',
      'unsubscribeMany',
    ])
  })

  it('IJournalStore expõe append, range, nextId e expire', () => {
    const probeJournal = {
      async append(_key: string, _entry: unknown): Promise<void> {},
      async range(_key: string, _start: number, _end: number): Promise<string[]> {
        return []
      },
      async nextId(_key: string): Promise<number> {
        return 0
      },
      async expire(_key: string, _seconds: number): Promise<void> {},
    }
    const probe: IJournalStore = probeJournal
    expect(Object.keys(probe)).toEqual(['append', 'range', 'nextId', 'expire'])
  })

  it('IStatusStore expõe get, set e clear', () => {
    const probeStatus = {
      async get(_key: string): Promise<Record<string, string> | null> {
        return null
      },
      async set(
        _key: string,
        _partial: Record<string, string | number | undefined>,
        _ttlSeconds?: number,
      ): Promise<void> {},
      async clear(_key: string): Promise<void> {},
    }
    const probe: IStatusStore = probeStatus
    expect(Object.keys(probe)).toEqual(['get', 'set', 'clear'])
  })

  it('ILockService expõe acquire, release e isLocked', () => {
    const probeLock = {
      async acquire(_key: string): Promise<boolean> {
        return true
      },
      async release(_key: string): Promise<void> {},
      async isLocked(_key: string): Promise<boolean> {
        return false
      },
    }
    const probe: ILockService = probeLock
    expect(Object.keys(probe)).toEqual(['acquire', 'release', 'isLocked'])
  })

  it('IQueueService é genérico e tipa data/QueueJob com o tipo informado', () => {
    interface Payload {
      chapter: number
    }
    const add = async (_name: string, _data: Payload, _opts?: QueueAddOptions) => {
      const job: QueueJob<Payload> = { id: 'id', name: _name, data: _data, attemptsMade: 0 }
      return job
    }
    const getJob = async (jobId: string) => {
      const job: QueueJob<Payload> = { id: jobId, name: 'job', data: { chapter: 1 }, attemptsMade: 0 }
      return job
    }
    const removeJob = async (_jobId: string) => {}
    const probe: IQueueService<Payload> = { add, getJob, removeJob }
    expect(typeof probe.add).toBe('function')
  })

  it('QueueAddOptions aceita jobId, attempts, backoff e removeOnComplete/removeOnFail', () => {
    const opts: QueueAddOptions = {
      jobId: 'job-1',
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
    }
    expect(opts.jobId).toBe('job-1')
    expect(opts.attempts).toBe(3)
    expect(opts.backoff).toEqual({ type: 'exponential', delay: 2000 })
    expect(opts.removeOnComplete).toEqual({ count: 100 })
    expect(opts.removeOnFail).toEqual({ count: 50 })
  })
})
