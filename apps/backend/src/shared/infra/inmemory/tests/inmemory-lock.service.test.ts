import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearSharedLockEntries,
  InMemoryLockService,
} from '../inmemory-lock.service'

beforeEach(() => {
  clearSharedLockEntries()
})

describe('InMemoryLockService', () => {
  it('acquire adquire o lock e isLocked devolve true', async () => {
    const lock = new InMemoryLockService()

    expect(await lock.acquire('source:1')).toBe(true)
    expect(await lock.isLocked('source:1')).toBe(true)
  })

  it('segundo acquire da MESMA instância devolve false (sem reentrância, como SET NX)', async () => {
    const lock = new InMemoryLockService()

    expect(await lock.acquire('source:1')).toBe(true)
    expect(await lock.acquire('source:1')).toBe(false)
  })

  it('instância B não adquire enquanto A detém o lock', async () => {
    const lockA = new InMemoryLockService()
    const lockB = new InMemoryLockService()

    expect(await lockA.acquire('source:1')).toBe(true)

    expect(await lockB.acquire('source:1')).toBe(false)
    expect(await lockB.isLocked('source:1')).toBe(true)
  })

  it('release da instância correta libera o lock e B consegue adquirir', async () => {
    const lockA = new InMemoryLockService()
    const lockB = new InMemoryLockService()

    await lockA.acquire('source:1')
    await lockA.release('source:1')

    expect(await lockA.isLocked('source:1')).toBe(false)
    expect(await lockB.acquire('source:1')).toBe(true)
  })

  it('release de instância errada NÃO libera o lock (no-op, sem lançar)', async () => {
    const lockA = new InMemoryLockService()
    const lockB = new InMemoryLockService()

    await lockA.acquire('source:1')
    await lockB.release('source:1')

    expect(await lockA.isLocked('source:1')).toBe(true)
    expect(await lockA.acquire('source:1')).toBe(false)
  })

  it('TTL padrão expira: isLocked false e novo acquire tem sucesso (fake timers)', async () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
      const lock = new InMemoryLockService()

      expect(await lock.acquire('source:1')).toBe(true)
      vi.setSystemTime(new Date('2026-01-01T00:01:59Z'))
      expect(await lock.isLocked('source:1')).toBe(true)

      vi.setSystemTime(new Date('2026-01-01T00:02:01Z'))
      expect(await lock.isLocked('source:1')).toBe(false)
      expect(await lock.acquire('source:1')).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('TTL re-configurável no constructor (ttlMs pequeno) expira corretamente', async () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
      const lock = new InMemoryLockService({ ttlMs: 5000 })

      expect(await lock.acquire('source:1')).toBe(true)

      vi.setSystemTime(new Date('2026-01-01T00:00:04Z'))
      expect(await lock.isLocked('source:1')).toBe(true)

      vi.setSystemTime(new Date('2026-01-01T00:00:06Z'))
      expect(await lock.isLocked('source:1')).toBe(false)
      expect(await lock.acquire('source:1')).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('locks de keys distintas são independentes', async () => {
    const lock = new InMemoryLockService()

    expect(await lock.acquire('source:a')).toBe(true)

    expect(await lock.acquire('source:b')).toBe(true)
    expect(await lock.isLocked('source:a')).toBe(true)
    expect(await lock.isLocked('source:b')).toBe(true)

    await lock.release('source:b')
    expect(await lock.isLocked('source:a')).toBe(true)
    expect(await lock.isLocked('source:b')).toBe(false)
  })
})
