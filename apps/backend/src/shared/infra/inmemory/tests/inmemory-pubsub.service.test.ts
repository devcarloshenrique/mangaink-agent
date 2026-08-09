import { describe, expect, it, vi } from 'vitest'
import { InMemoryPubSub } from '../inmemory-pubsub.service'

describe('InMemoryPubSub', () => {
  it('subscribe + publish → callback recebe a mensagem', async () => {
    const pubsub = new InMemoryPubSub()
    const cb = vi.fn()

    await pubsub.subscribe('chan', cb)
    await pubsub.publish('chan', { hello: 'world' })

    expect(cb).toHaveBeenCalledTimes(1)
    expect(cb).toHaveBeenCalledWith({ hello: 'world' })
  })

  it('dois subscribers no mesmo canal recebem ambos', async () => {
    const pubsub = new InMemoryPubSub()
    const a = vi.fn()
    const b = vi.fn()

    await pubsub.subscribe('chan', a)
    await pubsub.subscribe('chan', b)
    await pubsub.publish('chan', 'msg')

    expect(a).toHaveBeenCalledTimes(1)
    expect(a).toHaveBeenCalledWith('msg')
    expect(b).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledWith('msg')
  })

  it('handle.unsubscribe() → não recebe mais mensagens', async () => {
    const pubsub = new InMemoryPubSub()
    const cb = vi.fn()

    const handle = await pubsub.subscribe('chan', cb)
    await pubsub.publish('chan', 'one')
    await handle.unsubscribe()
    await pubsub.publish('chan', 'two')

    expect(cb).toHaveBeenCalledTimes(1)
    expect(cb).toHaveBeenCalledWith('one')
  })

  it('subscribeMany com 2 canais → callback recebe (channel, message) de ambos', async () => {
    const pubsub = new InMemoryPubSub()
    const cb = vi.fn()

    await pubsub.subscribeMany(['a', 'b'], cb)
    await pubsub.publish('a', 1)
    await pubsub.publish('b', 2)

    expect(cb).toHaveBeenCalledTimes(2)
    expect(cb).toHaveBeenNthCalledWith(1, 'a', 1)
    expect(cb).toHaveBeenNthCalledWith(2, 'b', 2)
  })

  it('subscribeMany: unsubscribe do handle remove de todos os canais', async () => {
    const pubsub = new InMemoryPubSub()
    const cb = vi.fn()

    const handle = await pubsub.subscribeMany(['a', 'b'], cb)
    await handle.unsubscribe()
    await pubsub.publish('a', 1)
    await pubsub.publish('b', 2)

    expect(cb).not.toHaveBeenCalled()
  })

  it('subscribe individual + subscribeMany no mesmo canal coexistem', async () => {
    const pubsub = new InMemoryPubSub()
    const individual = vi.fn()
    const many = vi.fn()

    await pubsub.subscribe('chan', individual)
    await pubsub.subscribeMany(['chan', 'other'], many)
    await pubsub.publish('chan', 'x')

    expect(individual).toHaveBeenCalledTimes(1)
    expect(individual).toHaveBeenCalledWith('x')
    expect(many).toHaveBeenCalledTimes(1)
    expect(many).toHaveBeenCalledWith('chan', 'x')
  })

  it('unsubscribe(channel, cb) remove só aquele callback', async () => {
    const pubsub = new InMemoryPubSub()
    const keep = vi.fn()
    const remove = vi.fn()

    await pubsub.subscribe('chan', keep)
    await pubsub.subscribe('chan', remove)
    await pubsub.unsubscribe('chan', remove)
    await pubsub.publish('chan', 'x')

    expect(keep).toHaveBeenCalledTimes(1)
    expect(remove).not.toHaveBeenCalled()
  })

  it('unsubscribeMany remove todos os callbacks dos canais', async () => {
    const pubsub = new InMemoryPubSub()
    const cb1 = vi.fn()
    const cb2 = vi.fn()

    await pubsub.subscribe('a', cb1)
    await pubsub.subscribe('b', cb2)
    await pubsub.unsubscribeMany(['a', 'b'])
    await pubsub.publish('a', 1)
    await pubsub.publish('b', 2)

    expect(cb1).not.toHaveBeenCalled()
    expect(cb2).not.toHaveBeenCalled()
  })

  it('publish sem subscribers não lança', async () => {
    const pubsub = new InMemoryPubSub()

    await expect(pubsub.publish('vazio', 'x')).resolves.toBeUndefined()
  })

  it('callback que lança não derruba o publish para os demais subscribers', async () => {
    const pubsub = new InMemoryPubSub()
    const bad = vi.fn(() => {
      throw new Error('boom')
    })
    const good = vi.fn()
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    try {
      await pubsub.subscribe('chan', bad)
      await pubsub.subscribe('chan', good)
      await pubsub.publish('chan', 'x')

      expect(good).toHaveBeenCalledTimes(1)
      expect(good).toHaveBeenCalledWith('x')
      expect(errorSpy).toHaveBeenCalled()
    } finally {
      errorSpy.mockRestore()
    }
  })
})
