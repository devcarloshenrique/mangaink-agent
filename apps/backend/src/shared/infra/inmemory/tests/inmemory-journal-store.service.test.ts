import { describe, expect, it, vi } from 'vitest'
import { InMemoryJournalStore } from '../inmemory-journal-store.service'

describe('InMemoryJournalStore', () => {
  it('append + range(0, -1) devolve todos os itens na ordem de inserção', async () => {
    const store = new InMemoryJournalStore()

    await store.append('key', { a: 1 })
    await store.append('key', { b: 2 })
    await store.append('key', { c: 3 })

    const entries = await store.range('key', 0, -1)
    expect(entries).toEqual([
      JSON.stringify({ a: 1 }),
      JSON.stringify({ b: 2 }),
      JSON.stringify({ c: 3 }),
    ])
  })

  it('range com índices parciais devolve sub-conjunto correto', async () => {
    const store = new InMemoryJournalStore()
    await store.append('key', 1)
    await store.append('key', 2)
    await store.append('key', 3)

    expect(await store.range('key', 0, 0)).toEqual(['1'])
    expect(await store.range('key', 1, 2)).toEqual(['2', '3'])
  })

  it('range com índices negativos (-2, -1) devolve os dois últimos', async () => {
    const store = new InMemoryJournalStore()
    await store.append('key', 'a')
    await store.append('key', 'b')
    await store.append('key', 'c')

    expect(await store.range('key', -2, -1)).toEqual(['"b"', '"c"'])
  })

  it('range em key inexistente devolve []', async () => {
    const store = new InMemoryJournalStore()

    expect(await store.range('nada', 0, -1)).toEqual([])
  })

  it('nextId é 1, 2, 3... monotônico e por key independente', async () => {
    const store = new InMemoryJournalStore()

    expect(await store.nextId('a')).toBe(1)
    expect(await store.nextId('a')).toBe(2)
    expect(await store.nextId('b')).toBe(1)
    expect(await store.nextId('a')).toBe(3)
  })

  it('expire: TTL no futuro mantém range funcionando', async () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
      const store = new InMemoryJournalStore()

      await store.append('key', 'x')
      await store.expire('key', 100)

      vi.setSystemTime(new Date('2026-01-01T00:01:00Z'))
      expect(await store.range('key', 0, -1)).toEqual(['"x"'])
    } finally {
      vi.useRealTimers()
    }
  })

  it('expire: após o TTL passar, range devolve [] e nextId recomeça em 1', async () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
      const store = new InMemoryJournalStore()

      await store.append('key', 'x')
      await store.nextId('key')
      await store.expire('key', 1)

      vi.setSystemTime(new Date('2026-01-01T00:00:02Z'))
      expect(await store.range('key', 0, -1)).toEqual([])
      expect(await store.nextId('key')).toBe(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('expire re-chamado reseta o TTL', async () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
      const store = new InMemoryJournalStore()

      await store.append('key', 'x')
      await store.expire('key', 1)

      vi.advanceTimersByTime(500)
      await store.expire('key', 1)
      vi.advanceTimersByTime(500)

      expect(await store.range('key', 0, -1)).toEqual(['"x"'])

      vi.advanceTimersByTime(500)
      expect(await store.range('key', 0, -1)).toEqual([])
    } finally {
      vi.useRealTimers()
    }
  })

  it('append após expiração cria nova lista', async () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
      const store = new InMemoryJournalStore()

      await store.append('key', 'antigo')
      await store.expire('key', 1)

      vi.setSystemTime(new Date('2026-01-01T00:00:02Z'))
      await store.append('key', 'novo')

      expect(await store.range('key', 0, -1)).toEqual(['"novo"'])
    } finally {
      vi.useRealTimers()
    }
  })
})
