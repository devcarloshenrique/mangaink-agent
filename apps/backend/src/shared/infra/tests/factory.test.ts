import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  InMemoryJournalStore,
  InMemoryLockService,
  InMemoryPubSub,
  InMemoryQueueService,
  InMemoryStatusStore,
} from '../inmemory'
import { createRedisQueueAdapter, createRuntimeAdapters } from '../factory'
import type { IQueueService } from '../queue.service'
import type { ConversionJobData } from '../../../modules/conversion/types/conversion.types'
import {
  RedisJournalAdapter,
  RedisLockAdapter,
  RedisPubSubAdapter,
  RedisQueueAdapter,
  RedisStatusStoreAdapter,
} from '../redis'

const mockPublish = vi.fn()
const mockSubscribe = vi.fn()
const mockUnsubscribe = vi.fn()
const mockQuit = vi.fn()
const mockOn = vi.fn()
const mockRpush = vi.fn()
const mockLrange = vi.fn()
const mockIncr = vi.fn()
const mockExpire = vi.fn()
const mockHset = vi.fn()
const mockHgetall = vi.fn()
const mockDel = vi.fn()
const mockSet = vi.fn()
const mockGet = vi.fn()
const mockEval = vi.fn()

const mockRedis = {
  publish: mockPublish,
  subscribe: mockSubscribe,
  unsubscribe: mockUnsubscribe,
  quit: mockQuit,
  on: mockOn,
  rpush: mockRpush,
  lrange: mockLrange,
  incr: mockIncr,
  expire: mockExpire,
  hset: mockHset,
  hgetall: mockHgetall,
  del: mockDel,
  set: mockSet,
  get: mockGet,
  eval: mockEval,
}

vi.mock('../../config/env', () => ({
  env: { MI_EMBEDDED_MODE: false, REDIS_URL: 'redis://localhost:6379' },
}))

vi.mock('../../redis/safe-redis', () => ({
  createSafeRedis: vi.fn(),
}))

vi.mock('../../redis/bullmq', () => ({
  createQueue: vi.fn(),
}))

import { env } from '../../config/env'
import { createSafeRedis } from '../../redis/safe-redis'
import { createQueue } from '../../redis/bullmq'

beforeEach(() => {
  vi.resetAllMocks()
  env.MI_EMBEDDED_MODE = false
  vi.mocked(createSafeRedis).mockReturnValue(mockRedis as never)
  vi.mocked(createQueue).mockReturnValue({} as never)
})

describe('createRuntimeAdapters', () => {
  it('embedded: true devolve adaptadores in-memory', () => {
    const adapters = createRuntimeAdapters({ embedded: true })

    expect(adapters.queue).toBeInstanceOf(InMemoryQueueService)
    expect(adapters.pubsub).toBeInstanceOf(InMemoryPubSub)
    expect(adapters.journal).toBeInstanceOf(InMemoryJournalStore)
    expect(adapters.status).toBeInstanceOf(InMemoryStatusStore)
    expect(adapters.lock).toBeInstanceOf(InMemoryLockService)
  })

  it('embedded: false devolve adaptadores Redis sem conectar no load', () => {
    const adapters = createRuntimeAdapters({ embedded: false })

    expect(adapters.queue).toBeInstanceOf(RedisQueueAdapter)
    expect(adapters.pubsub).toBeInstanceOf(RedisPubSubAdapter)
    expect(adapters.journal).toBeInstanceOf(RedisJournalAdapter)
    expect(adapters.status).toBeInstanceOf(RedisStatusStoreAdapter)
    expect(adapters.lock).toBeInstanceOf(RedisLockAdapter)

    expect(vi.mocked(createSafeRedis)).not.toHaveBeenCalled()
    expect(vi.mocked(createQueue)).not.toHaveBeenCalled()
  })

  it('adapters Redis conectam somente na primeira operação', async () => {
    const adapters = createRuntimeAdapters({ embedded: false })

    await adapters.journal.append('chave', { a: 1 })
    expect(vi.mocked(createSafeRedis)).toHaveBeenCalledTimes(1)

    await adapters.status.set('chave', { a: '1' })
    expect(vi.mocked(createSafeRedis)).toHaveBeenCalledTimes(2)
  })

  describe('default usa env.MI_EMBEDDED_MODE', () => {
    it('MI_EMBEDDED_MODE=true → in-memory', () => {
      env.MI_EMBEDDED_MODE = true

      const adapters = createRuntimeAdapters()

      expect(adapters.queue).toBeInstanceOf(InMemoryQueueService)
      expect(adapters.pubsub).toBeInstanceOf(InMemoryPubSub)
      expect(adapters.journal).toBeInstanceOf(InMemoryJournalStore)
      expect(adapters.status).toBeInstanceOf(InMemoryStatusStore)
      expect(adapters.lock).toBeInstanceOf(InMemoryLockService)
    })

    it('MI_EMBEDDED_MODE=false → Redis', () => {
      env.MI_EMBEDDED_MODE = false

      const adapters = createRuntimeAdapters()

      expect(adapters.queue).toBeInstanceOf(RedisQueueAdapter)
      expect(adapters.pubsub).toBeInstanceOf(RedisPubSubAdapter)
      expect(adapters.journal).toBeInstanceOf(RedisJournalAdapter)
      expect(adapters.status).toBeInstanceOf(RedisStatusStoreAdapter)
      expect(adapters.lock).toBeInstanceOf(RedisLockAdapter)
    })
  })

  describe('getQueue', () => {
    it('embedded: devolve instâncias DISTINTAS por nome e processa jobs enfileirados', async () => {
      const adapters = createRuntimeAdapters({ embedded: true })
      const qa = adapters.getQueue('a') as unknown as InMemoryQueueService
      const qb = adapters.getQueue('b') as unknown as InMemoryQueueService

      expect(qa).not.toBe(qb)

      const processed: string[] = []
      let resolveDone: (() => void) | undefined
      const done = new Promise<void>((resolve) => {
        resolveDone = resolve
      })

      await qa.process(async (job) => {
        processed.push(job.data as string)
        if (processed.length === 2) resolveDone?.()
      }, { concurrency: 1 })

      await qa.add('job', 'x1')
      await qa.add('job', 'x2')
      await done

      expect(processed).toEqual(['x1', 'x2'])
      await qa.close()
    })

    it('embedded: o MESMO nome devolve a MESMA instância (registry por nome)', () => {
      const adapters = createRuntimeAdapters({ embedded: true })

      expect(adapters.getQueue('conversion-job')).toBe(adapters.getQueue('conversion-job'))
    })

    it('web: devolve um RedisQueueAdapter', () => {
      const adapters = createRuntimeAdapters({ embedded: false })

      expect(adapters.getQueue('x')).toBeInstanceOf(RedisQueueAdapter)
    })
  })
})

describe('createRedisQueueAdapter', () => {
  it('retorna um adapter tipado pelo contrato genérico IQueueService<T>', () => {
    const q: IQueueService<ConversionJobData> = createRedisQueueAdapter<ConversionJobData>('conversion-job')

    expect(q).toBeInstanceOf(RedisQueueAdapter)
  })

  it('cria a fila BullMQ somente na primeira operação (lazy)', async () => {
    const mockCreateQueue = vi.mocked(createQueue)
    const queue = createRedisQueueAdapter('source-inspect')

    expect(mockCreateQueue).not.toHaveBeenCalled()

    mockCreateQueue.mockReturnValue({
      add: vi.fn().mockResolvedValue({ id: 'j1', name: 'inspect', data: { url: 'x' }, attemptsMade: 0 }),
      getJob: vi.fn(),
      removeJob: vi.fn(),
    } as never)

    await queue.add('inspect', { url: 'x' })
    expect(mockCreateQueue).toHaveBeenCalledWith('source-inspect')
  })

  it('add mapeia o job BullMQ para QueueJob e repassa opções', async () => {
    const mockQueue = {
      add: vi.fn().mockResolvedValue({ id: 'j1', name: 'inspect', data: { url: 'x' }, attemptsMade: 1 }),
      getJob: vi.fn(),
      removeJob: vi.fn(),
    }
    vi.mocked(createQueue).mockReturnValue(mockQueue as never)

    const queue = createRedisQueueAdapter('source-inspect')
    const job = await queue.add('inspect', { url: 'x' }, { attempts: 3 })

    expect(mockQueue.add).toHaveBeenCalledWith('inspect', { url: 'x' }, { attempts: 3 })
    expect(job).toEqual({ id: 'j1', name: 'inspect', data: { url: 'x' }, attemptsMade: 1 })
  })

  it('getJob devolve null quando o job não existe', async () => {
    const mockQueue = {
      add: vi.fn(),
      getJob: vi.fn().mockResolvedValue(null),
      removeJob: vi.fn(),
    }
    vi.mocked(createQueue).mockReturnValue(mockQueue as never)

    const queue = createRedisQueueAdapter('x')
    expect(await queue.getJob('nope')).toBeNull()
    expect(mockQueue.getJob).toHaveBeenCalledWith('nope')
  })

  it('removeJob chama remove no job recuperado', async () => {
    const remove = vi.fn().mockResolvedValue(undefined)
    const mockQueue = {
      add: vi.fn(),
      getJob: vi.fn().mockResolvedValue({ remove }),
      removeJob: vi.fn(),
    }
    vi.mocked(createQueue).mockReturnValue(mockQueue as never)

    const queue = createRedisQueueAdapter('x')
    await queue.removeJob('j1')

    expect(mockQueue.getJob).toHaveBeenCalledWith('j1')
    expect(remove).toHaveBeenCalled()
  })
})

describe('RedisPubSubAdapter', () => {
  function captureMessageHandler(): (channel: string, data: string) => void {
    let handler: (channel: string, data: string) => void = () => {}
    mockOn.mockImplementation((event: string, cb: (channel: string, data: string) => void) => {
      if (event === 'message') handler = cb
    })
    return (channel, data) => handler(channel, data)
  }

  it('publish serializa JSON e usa a conexão publisher', async () => {
    const pubsub = new RedisPubSubAdapter()

    await pubsub.publish('canal-a', { n: 1 })

    expect(mockPublish).toHaveBeenCalledWith('canal-a', '{"n":1}')
  })

  it('subscribe cria subscriber, registra listener e devolve handle com unsubscribe', async () => {
    const emit = captureMessageHandler()
    const received: any[] = []
    const pubsub = new RedisPubSubAdapter()

    const handle = await pubsub.subscribe('canal-a', (msg) => received.push(msg))

    expect(mockSubscribe).toHaveBeenCalledWith('canal-a')
    expect(mockOn).toHaveBeenCalledWith('message', expect.any(Function))

    emit('canal-a', '{"n":1}')
    expect(received).toEqual([{ n: 1 }])

    await handle.unsubscribe()
    expect(mockUnsubscribe).toHaveBeenCalledWith('canal-a')
  })

  it('subscribeMany assina múltiplos canais e despacha com o canal', async () => {
    const emit = captureMessageHandler()
    const received: any[] = []
    const pubsub = new RedisPubSubAdapter()

    const handle = await pubsub.subscribeMany(['a', 'b'], (ch, msg) => received.push([ch, msg]))

    expect(mockSubscribe).toHaveBeenCalledWith('a')
    expect(mockSubscribe).toHaveBeenCalledWith('b')

    emit('a', '{"n":1}')
    emit('b', '{"n":2}')
    expect(received).toEqual([
      ['a', { n: 1 }],
      ['b', { n: 2 }],
    ])

    await handle.unsubscribe()
    expect(mockUnsubscribe).toHaveBeenCalledWith('a')
    expect(mockUnsubscribe).toHaveBeenCalledWith('b')
  })

  it('unsubscribeMany remove os listeners dos canais', async () => {
    captureMessageHandler()
    const pubsub = new RedisPubSubAdapter()

    await pubsub.subscribe('a', () => {})
    await pubsub.unsubscribeMany(['a'])

    expect(mockUnsubscribe).toHaveBeenCalledWith('a')
  })

  it('mensagens não-JSON são entregues como string bruta', async () => {
    const emit = captureMessageHandler()
    const received: any[] = []
    const pubsub = new RedisPubSubAdapter()

    await pubsub.subscribe('canal-a', (msg) => received.push(msg))
    emit('canal-a', 'texto-bruto')

    expect(received).toEqual(['texto-bruto'])
  })
})

describe('RedisJournalAdapter', () => {
  it('append usa RPUSH com payload serializado', async () => {
    const journal = new RedisJournalAdapter()

    await journal.append('chave', { e: 1 })

    expect(mockRpush).toHaveBeenCalledWith('chave', '{"e":1}')
  })

  it('range usa LRANGE e devolve as entradas', async () => {
    mockLrange.mockResolvedValue(['a', 'b'])
    const journal = new RedisJournalAdapter()

    expect(await journal.range('chave', 0, -1)).toEqual(['a', 'b'])
    expect(mockLrange).toHaveBeenCalledWith('chave', 0, -1)
  })

  it('nextId usa INCR', async () => {
    mockIncr.mockResolvedValue(5)
    const journal = new RedisJournalAdapter()

    expect(await journal.nextId('chave')).toBe(5)
    expect(mockIncr).toHaveBeenCalledWith('chave')
  })

  it('expire usa EXPIRE com o TTL informado', async () => {
    const journal = new RedisJournalAdapter()

    await journal.expire('chave', 100)

    expect(mockExpire).toHaveBeenCalledWith('chave', 100)
  })
})

describe('RedisStatusStoreAdapter', () => {
  it('set usa HSET filtrando undefined e aplica EXPIRE opcional', async () => {
    const status = new RedisStatusStoreAdapter()

    await status.set('key', { status: 'ok', progress: 42, err: undefined }, 60)

    expect(mockHset).toHaveBeenCalledWith('key', 'status', 'ok', 'progress', '42')
    expect(mockExpire).toHaveBeenCalledWith('key', 60)
  })

  it('set sem campos não chama HSET nem EXPIRE', async () => {
    const status = new RedisStatusStoreAdapter()

    await status.set('key', { err: undefined })

    expect(mockHset).not.toHaveBeenCalled()
    expect(mockExpire).not.toHaveBeenCalled()
  })

  it('get devolve null quando o hash está vazio', async () => {
    mockHgetall.mockResolvedValue({})
    const status = new RedisStatusStoreAdapter()

    expect(await status.get('key')).toBeNull()
  })

  it('get devolve os campos do hash', async () => {
    mockHgetall.mockResolvedValue({ status: 'ok' })
    const status = new RedisStatusStoreAdapter()

    expect(await status.get('key')).toEqual({ status: 'ok' })
    expect(mockHgetall).toHaveBeenCalledWith('key')
  })

  it('clear usa DEL', async () => {
    const status = new RedisStatusStoreAdapter()

    await status.clear('key')

    expect(mockDel).toHaveBeenCalledWith('key')
  })
})

describe('RedisLockAdapter', () => {
  it('acquire delega ao RedisLockService (SET NX EX)', async () => {
    mockSet.mockResolvedValue('OK')
    const lock = new RedisLockAdapter()

    expect(await lock.acquire('src-x')).toBe(true)
    expect(mockSet).toHaveBeenCalledWith(
      expect.stringContaining('lock:source:src-x'),
      expect.any(String),
      'EX',
      120,
      'NX',
    )
  })

  it('release delega ao RedisLockService (script Lua atômico)', async () => {
    mockEval.mockResolvedValue(1)
    const lock = new RedisLockAdapter()

    await lock.release('src-x')
    expect(mockEval).toHaveBeenCalledWith(
      expect.stringContaining('redis.call("GET", KEYS[1])'),
      1,
      expect.stringContaining('lock:source:src-x'),
      expect.any(String),
    )
  })

  it('isLocked delega ao RedisLockService', async () => {
    mockGet.mockResolvedValue('worker-1')
    const lock = new RedisLockAdapter()
    expect(await lock.isLocked('src-x')).toBe(true)

    mockGet.mockResolvedValue(null)
    expect(await lock.isLocked('src-x')).toBe(false)
  })
})
