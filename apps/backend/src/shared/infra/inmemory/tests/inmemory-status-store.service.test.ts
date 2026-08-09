import { describe, expect, it, vi } from 'vitest'
import { InMemoryStatusStore } from '../inmemory-status-store.service'

describe('InMemoryStatusStore', () => {
  it('set + get devolve os campos (valores numéricos convertidos para string)', async () => {
    const store = new InMemoryStatusStore()

    await store.set('job:1', { status: 'running', progress: 50 })

    expect(await store.get('job:1')).toEqual({ status: 'running', progress: '50' })
  })

  it('merge parcial: segundo set preserva campos não informados e atualiza os informados', async () => {
    const store = new InMemoryStatusStore()

    await store.set('job:1', { a: '1', b: '2' })
    await store.set('job:1', { b: '3', c: '4' })

    expect(await store.get('job:1')).toEqual({ a: '1', b: '3', c: '4' })
  })

  it('undefined no partial é ignorado (não sobrescreve campo existente)', async () => {
    const store = new InMemoryStatusStore()

    await store.set('job:1', { a: '1' })
    await store.set('job:1', { a: undefined, b: '2' })

    expect(await store.get('job:1')).toEqual({ a: '1', b: '2' })
  })

  it('get em key inexistente devolve null', async () => {
    const store = new InMemoryStatusStore()

    expect(await store.get('nada')).toBeNull()
  })

  it('clear remove a chave inteira; set depois funciona normalmente', async () => {
    const store = new InMemoryStatusStore()
    await store.set('job:1', { a: '1' })

    await store.clear('job:1')

    expect(await store.get('job:1')).toBeNull()
    await store.set('job:1', { b: '2' })
    expect(await store.get('job:1')).toEqual({ b: '2' })
  })

  it('TTL: antes da expiração get devolve campos; após, null', async () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
      const store = new InMemoryStatusStore()

      await store.set('job:1', { status: 'running' }, 10)

      vi.setSystemTime(new Date('2026-01-01T00:00:09Z'))
      expect(await store.get('job:1')).toEqual({ status: 'running' })

      vi.setSystemTime(new Date('2026-01-01T00:00:11Z'))
      expect(await store.get('job:1')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('TTL resetado: set com ttl renovado mantém a key viva', async () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
      const store = new InMemoryStatusStore()

      await store.set('job:1', { a: '1' }, 10)
      vi.advanceTimersByTime(5000)

      await store.set('job:1', { b: '2' }, 10)
      vi.advanceTimersByTime(5000)
      expect(await store.get('job:1')).toEqual({ a: '1', b: '2' })

      vi.advanceTimersByTime(5000)
      expect(await store.get('job:1')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('set sem ttl não expira (avançar muito tempo ainda presente)', async () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
      const store = new InMemoryStatusStore()

      await store.set('job:1', { a: '1' })

      vi.advanceTimersByTime(86400 * 1000 * 30)
      expect(await store.get('job:1')).toEqual({ a: '1' })
    } finally {
      vi.useRealTimers()
    }
  })

  it('set sem ttl NÃO cancela TTL prévio (último set com ttl vence)', async () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
      const store = new InMemoryStatusStore()

      await store.set('job:1', { a: '1' }, 5)
      await store.set('job:1', { b: '2' })

      vi.advanceTimersByTime(6000)
      expect(await store.get('job:1')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })
})
