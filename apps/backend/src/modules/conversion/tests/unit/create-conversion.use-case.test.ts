import { describe, it, expect, beforeEach, vi } from 'vitest'
import { CreateConversionUseCase } from '../../use-cases/create-conversion.use-case'
import { InMemoryConversionRepository } from '../helpers/in-memory-conversion.repository'
import { MockJobRepository } from '../helpers/mock-job.repository'
import { MockConversionQueueService } from '../helpers/mock-conversion-queue.service'
import { MockConversionEventsService } from '../helpers/mock-conversion-events.service'
import { makeConversionConfig, makeSourceMetadata } from '../helpers/fixtures'
import {
  ValidationError,
  SourceNotFoundError,
  DuplicateChapterError,
  ChapterNotFoundError,
} from '../../errors/conversion.errors'

const shared = vi.hoisted(() => {
  const sourceStore = new Map<string, unknown>()
  return {
    sourceStore,
    resetSources: () => sourceStore.clear(),
    setSource: (sourceId: string, metadata: unknown) => sourceStore.set(sourceId, metadata),
    pathExists: vi.fn(async (p: string) => {
      const id = Object.keys(Object.fromEntries(sourceStore)).find((key) => p.includes(key))
      return id ? sourceStore.has(id) : false
    }),
    readJson: vi.fn(async (p: string) => {
      const id = Object.keys(Object.fromEntries(sourceStore)).find((key) => p.includes(key))
      return id ? sourceStore.get(id) ?? null : null
    }),
  }
})

vi.mock('../../../../shared/utils/filesystem', () => ({
  pathExists: shared.pathExists,
  readJson: shared.readJson,
}))

let conversions: InMemoryConversionRepository
let jobs: MockJobRepository
let queue: MockConversionQueueService
let events: MockConversionEventsService
let useCase: CreateConversionUseCase

beforeEach(() => {
  shared.resetSources()
  conversions = new InMemoryConversionRepository()
  jobs = new MockJobRepository()
  queue = new MockConversionQueueService()
  events = new MockConversionEventsService()
  useCase = new CreateConversionUseCase(conversions, jobs, queue, events)
})

describe('CreateConversionUseCase (Planner)', () => {
  it('deve criar uma Conversion com 1 Book e gerar 1 Job', async () => {
    shared.setSource('src-hunter-x-hunter-cb3c9071', makeSourceMetadata())

    const config = makeConversionConfig()
    const result = await useCase.execute(config)

    expect(result.conversionId).toMatch(/^conv_/)
    expect(result.status).toBe('queued')
    expect(result.totalJobs).toBe(1)
    expect(jobs.created).toHaveLength(1)
    expect(queue.enqueued).toHaveLength(1)

    const state = await conversions.findById(result.conversionId)
    expect(state).not.toBeNull()
    expect(state!.status).toBe('queued')
    expect(state!.totalJobs).toBe(1)
    expect(state!.pendingJobs).toBe(1)
  })

  it('deve gerar N Jobs para N Books', async () => {
    shared.setSource('src-hunter-x-hunter-cb3c9071', makeSourceMetadata([
      'chap_0001', 'chap_0002', 'chap_0003', 'chap_0004',
    ]))

    const config = makeConversionConfig({
      books: [
        { title: 'Vol 01', chapters: ['chap_0001', 'chap_0002'] },
        { title: 'Vol 02', chapters: ['chap_0003', 'chap_0004'] },
      ],
    })
    const result = await useCase.execute(config)

    expect(result.totalJobs).toBe(2)
    expect(jobs.created).toHaveLength(2)
    expect(queue.enqueued).toHaveLength(2)

    expect(jobs.created[0].config.metadata.title).toBe('Vol 01')
    expect(jobs.created[1].config.metadata.title).toBe('Vol 02')
  })

  it('deve rejeitar deviceId inválido', async () => {
    shared.setSource('src-hunter-x-hunter-cb3c9071', makeSourceMetadata())
    const config = makeConversionConfig({ output: { deviceId: 'INVALID_DEVICE', format: 'EPUB' } })
    await expect(useCase.execute(config)).rejects.toThrow(ValidationError)
  })

  it('deve rejeitar format inválido', async () => {
    shared.setSource('src-hunter-x-hunter-cb3c9071', makeSourceMetadata())
    const config = makeConversionConfig({ output: { deviceId: 'K11', format: 'INVALID_FMT' } })
    await expect(useCase.execute(config)).rejects.toThrow(ValidationError)
  })

  it('deve rejeitar sourceId inexistente', async () => {
    const config = makeConversionConfig({ sourceId: 'src-inexistente' })
    await expect(useCase.execute(config)).rejects.toThrow(SourceNotFoundError)
  })

  it('deve rejeitar capítulo duplicado entre Books', async () => {
    shared.setSource('src-hunter-x-hunter-cb3c9071', makeSourceMetadata([
      'chap_0001', 'chap_0002', 'chap_0003',
    ]))
    const config = makeConversionConfig({
      books: [
        { title: 'Vol 01', chapters: ['chap_0001', 'chap_0002'] },
        { title: 'Vol 02', chapters: ['chap_0002', 'chap_0003'] },
      ],
    })
    await expect(useCase.execute(config)).rejects.toThrow(DuplicateChapterError)
  })

  it('deve rejeitar capítulo inexistente na source', async () => {
    shared.setSource('src-hunter-x-hunter-cb3c9071', makeSourceMetadata(['chap_0001']))
    const config = makeConversionConfig({
      books: [{ title: 'Vol 01', chapters: ['chap_0001', 'chap_9999'] }],
    })
    await expect(useCase.execute(config)).rejects.toThrow(ChapterNotFoundError)
  })

  it('deve herdar capa global quando Book não tem capa própria', async () => {
    shared.setSource('src-hunter-x-hunter-cb3c9071', makeSourceMetadata(['chap_0001', 'chap_0002']))
    const config = makeConversionConfig({
      cover: { kind: 'original' },
      books: [{ title: 'Vol 01', chapters: ['chap_0001', 'chap_0002'] }],
    })
    await useCase.execute(config)

    expect(jobs.created[0].config.cover).toEqual({ kind: 'original' })
  })

  it('deve usar capa própria do Book quando definida', async () => {
    shared.setSource('src-hunter-x-hunter-cb3c9071', makeSourceMetadata([
      'chap_0001', 'chap_0002', 'chap_0003',
    ]))
    const config = makeConversionConfig({
      cover: { kind: 'original' },
      books: [
        { title: 'Vol 01', chapters: ['chap_0001', 'chap_0002'] },
        { title: 'Vol 02', chapters: ['chap_0003'], cover: { kind: 'gallery', coverId: 'cover_custom' } },
      ],
    })
    await useCase.execute(config)

    expect(jobs.created[0].config.cover).toEqual({ kind: 'original' })
    expect(jobs.created[1].config.cover).toEqual({ kind: 'gallery', coverId: 'cover_custom' })
  })

  it('deve definir batchSplit=none e fileFusion=false em todo Job', async () => {
    shared.setSource('src-hunter-x-hunter-cb3c9071', makeSourceMetadata([
      'chap_0001', 'chap_0002', 'chap_0003', 'chap_0004',
    ]))
    const config = makeConversionConfig({
      books: [
        { title: 'Vol 01', chapters: ['chap_0001'] },
        { title: 'Vol 02', chapters: ['chap_0002', 'chap_0003', 'chap_0004'] },
      ],
    })
    await useCase.execute(config)

    for (const job of jobs.created) {
      expect(job.config.options.batchSplit).toBe('none')
      expect(job.config.options.fileFusion).toBe(false)
    }
  })

  it('deve emitir evento conversion.created', async () => {
    shared.setSource('src-hunter-x-hunter-cb3c9071', makeSourceMetadata())
    const result = await useCase.execute(makeConversionConfig())

    const createdEvents = events.emitted.filter(
      (e) => e.event.type === 'conversion.created',
    )
    expect(createdEvents).toHaveLength(1)
    expect(createdEvents[0].event.data.totalJobs).toBe(1)
  })

  it('deve propagar errorHandlingStrategy do config para cada Job', async () => {
    shared.setSource('src-hunter-x-hunter-cb3c9071', makeSourceMetadata(['chap_0001', 'chap_0002']))
    const config = makeConversionConfig({
      books: [
        { title: 'Vol 01', chapters: ['chap_0001', 'chap_0002'] },
      ],
      errorHandlingStrategy: 'abort',
    })
    await useCase.execute(config)

    for (const job of jobs.created) {
      expect(job.config.errorHandlingStrategy).toBe('abort')
    }
  })

  it('deve manter errorHandlingStrategy undefined quando nao definido no config', async () => {
    shared.setSource('src-hunter-x-hunter-cb3c9071', makeSourceMetadata(['chap_0001']))
    const config = makeConversionConfig({
      books: [{ title: 'Vol 01', chapters: ['chap_0001'] }],
    })
    await useCase.execute(config)

    expect(jobs.created[0].config.errorHandlingStrategy).toBeUndefined()
  })

  it('deve propagar errorHandlingStrategy do config para cada Job', async () => {
    shared.setSource('src-hunter-x-hunter-cb3c9071', makeSourceMetadata(['chap_0001']))
    const config = makeConversionConfig({
      errorHandlingStrategy: 'abort',
      books: [{ title: 'Vol 01', chapters: ['chap_0001'] }],
    })
    await useCase.execute(config)
    expect(jobs.created[0].config.errorHandlingStrategy).toBe('abort')
    expect(queue.enqueued[0].errorHandlingStrategy).toBe('abort')
  })

  it('errorHandlingStrategy padrão deve ser undefined', async () => {
    shared.setSource('src-hunter-x-hunter-cb3c9071', makeSourceMetadata(['chap_0001']))
    const config = makeConversionConfig({
      books: [{ title: 'Vol 01', chapters: ['chap_0001'] }],
    })
    await useCase.execute(config)
    expect(jobs.created[0].config.errorHandlingStrategy).toBeUndefined()
  })
})
