import { describe, it, expect, beforeEach } from 'vitest'
import { ListConversionsUseCase } from '../../use-cases/list-conversions.use-case'
import { InMemoryConversionRepository } from '../helpers/in-memory-conversion.repository'
import { makeConversionConfig } from '../helpers/fixtures'
import type { ConversionState } from '../../types/conversion.types'

const USER_A = 'user-a-001'
const USER_B = 'user-b-002'
const SRC_X = 'src-abc-123'
const SRC_Y = 'src-def-456'

let conversions: InMemoryConversionRepository
let useCase: ListConversionsUseCase

function makeState(
  id: string,
  userId: string,
  sourceId: string,
  overrides: Partial<ConversionState> = {},
): ConversionState {
  const createdAt = new Date(Date.now() - Math.random() * 100000).toISOString()
  return {
    conversionId: id,
    status: 'queued',
    progress: 0,
    totalJobs: 1,
    completedJobs: 0,
    failedJobs: 0,
    runningJobs: 0,
    pendingJobs: 1,
    createdAt,
    updatedAt: createdAt,
    jobs: [],
    config: makeConversionConfig({ userId, sourceId }),
    ...overrides,
  }
}

beforeEach(() => {
  conversions = new InMemoryConversionRepository()
  useCase = new ListConversionsUseCase(conversions)
})

describe('ListConversionsUseCase', () => {
  it('lista apenas conversões do usuário A (não vê as de B)', async () => {
    await conversions.create(makeState('conv-1', USER_A, SRC_X))
    await conversions.create(makeState('conv-2', USER_A, SRC_Y))
    await conversions.create(makeState('conv-3', USER_A, SRC_X))
    await conversions.create(makeState('conv-4', USER_B, SRC_X))

    const result = await useCase.execute(USER_A, { page: 1, limit: 20 })

    expect(result.total).toBe(3)
    expect(result.items).toHaveLength(3)
    expect(result.items.every((i) => i.conversionId !== 'conv-4')).toBe(true)
  })

  it('filtra por status=completed', async () => {
    await conversions.create(
      makeState('conv-1', USER_A, SRC_X, { status: 'completed', completedJobs: 1, pendingJobs: 0 }),
    )
    await conversions.create(makeState('conv-2', USER_A, SRC_Y, { status: 'queued' }))
    await conversions.create(
      makeState('conv-3', USER_A, SRC_X, { status: 'completed', completedJobs: 1, pendingJobs: 0 }),
    )

    const result = await useCase.execute(USER_A, { page: 1, limit: 20, status: ['completed'] })

    expect(result.total).toBe(2)
    expect(result.items.every((i) => i.status === 'completed')).toBe(true)
  })

  it('filtra por sourceId=src-x', async () => {
    await conversions.create(makeState('conv-1', USER_A, SRC_X))
    await conversions.create(makeState('conv-2', USER_A, SRC_Y))
    await conversions.create(makeState('conv-3', USER_A, SRC_X))

    const result = await useCase.execute(USER_A, { page: 1, limit: 20, sourceId: SRC_X })

    expect(result.total).toBe(2)
    expect(result.items.every((i) => i.sourceId === SRC_X)).toBe(true)
  })

  it('pagina corretamente (page=1 limit=2 -> 2 items; page=2 -> 1 item; total=3)', async () => {
    await conversions.create(makeState('conv-1', USER_A, SRC_X))
    await conversions.create(makeState('conv-2', USER_A, SRC_X))
    await conversions.create(makeState('conv-3', USER_A, SRC_X))

    const page1 = await useCase.execute(USER_A, { page: 1, limit: 2 })
    expect(page1.items).toHaveLength(2)
    expect(page1.total).toBe(3)
    expect(page1.page).toBe(1)
    expect(page1.limit).toBe(2)

    const page2 = await useCase.execute(USER_A, { page: 2, limit: 2 })
    expect(page2.items).toHaveLength(1)
    expect(page2.total).toBe(3)
    expect(page2.page).toBe(2)
  })

  it('lista vazia retorna { items: [], total: 0, page: 1, limit: 20 }', async () => {
    const result = await useCase.execute(USER_A, { page: 1, limit: 20 })

    expect(result.items).toEqual([])
    expect(result.total).toBe(0)
    expect(result.page).toBe(1)
    expect(result.limit).toBe(20)
  })

  it('items não incluem snapshot pesado (books/options/jobs)', async () => {
    await conversions.create(makeState('conv-1', USER_A, SRC_X))

    const result = await useCase.execute(USER_A, { page: 1, limit: 20 })
    const item = result.items[0]

    expect(item).not.toHaveProperty('books')
    expect(item).not.toHaveProperty('options')
    expect(item).not.toHaveProperty('jobs')
    expect(item).not.toHaveProperty('config')
  })

  it('items contêm campos do summary', async () => {
    await conversions.create(
      makeState('conv-1', USER_A, SRC_X, {
        status: 'completed',
        progress: 100,
        totalJobs: 2,
        completedJobs: 2,
        failedJobs: 0,
      }),
    )

    const result = await useCase.execute(USER_A, { page: 1, limit: 20 })
    const item = result.items[0]

    expect(item).toMatchObject({
      conversionId: 'conv-1',
      sourceId: SRC_X,
      title: 'Hunter x Hunter',
      status: 'completed',
      progress: 100,
      totalJobs: 2,
      completedJobs: 2,
      failedJobs: 0,
    })
    expect(item).toHaveProperty('createdAt')
    expect(item).toHaveProperty('updatedAt')
  })

  it('ordena por createdAt DESC', async () => {
    const old = makeState('conv-old', USER_A, SRC_X)
    old.createdAt = '2020-01-01T00:00:00.000Z'
    old.updatedAt = old.createdAt
    await conversions.create(old)

    const newer = makeState('conv-new', USER_A, SRC_X)
    newer.createdAt = '2025-06-01T00:00:00.000Z'
    newer.updatedAt = newer.createdAt
    await conversions.create(newer)

    const result = await useCase.execute(USER_A, { page: 1, limit: 20 })

    expect(result.items[0].conversionId).toBe('conv-new')
    expect(result.items[1].conversionId).toBe('conv-old')
  })

  it('combina filtros status + sourceId', async () => {
    await conversions.create(
      makeState('conv-1', USER_A, SRC_X, { status: 'completed', completedJobs: 1, pendingJobs: 0 }),
    )
    await conversions.create(makeState('conv-2', USER_A, SRC_Y, { status: 'completed' }))
    await conversions.create(makeState('conv-3', USER_A, SRC_X, { status: 'queued' }))

    const result = await useCase.execute(USER_A, {
      page: 1,
      limit: 20,
      status: ['completed'],
      sourceId: SRC_X,
    })

    expect(result.total).toBe(1)
    expect(result.items[0].conversionId).toBe('conv-1')
  })

  it('filtra por múltiplos status (array)', async () => {
    await conversions.create(makeState('conv-q', USER_A, SRC_X, { status: 'queued', pendingJobs: 1, runningJobs: 0 }))
    await conversions.create(makeState('conv-p', USER_A, SRC_X, { status: 'processing', runningJobs: 1, pendingJobs: 0 }))
    await conversions.create(makeState('conv-c', USER_A, SRC_X, { status: 'completed', completedJobs: 1, pendingJobs: 0 }))

    const result = await useCase.execute(USER_A, { page: 1, limit: 20, status: ['queued', 'processing'] })

    expect(result.total).toBe(2)
    expect(result.items.map((i) => i.conversionId).sort()).toEqual(['conv-p', 'conv-q'])
  })

  it('filtro sem status retorna todos', async () => {
    await conversions.create(makeState('conv-1', USER_A, SRC_X))
    await conversions.create(makeState('conv-2', USER_A, SRC_X, { status: 'completed', completedJobs: 1, pendingJobs: 0 }))
    await conversions.create(makeState('conv-3', USER_A, SRC_X, { status: 'failed', failedJobs: 1, pendingJobs: 0 }))

    const result = await useCase.execute(USER_A, { page: 1, limit: 20 })

    expect(result.total).toBe(3)
  })
})