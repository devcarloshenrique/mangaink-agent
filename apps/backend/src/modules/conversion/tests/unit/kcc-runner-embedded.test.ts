import { EventEmitter } from 'node:events'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { KccRunnerService, type IKccRunner } from '../../services/kcc-runner.service'
import { KccRunnerEmbedded } from '../../services/kcc-runner-embedded.service'
import { KccExecutionError } from '../../errors/conversion.errors'

/**
 * FakeChild: imita o retorno de child_process.spawn — stdout/stderr são
 * EventEmitters e `close`/`error` podem ser disparados manualmente.
 */
class FakeChild extends EventEmitter {
  stdout = new EventEmitter()
  stderr = new EventEmitter()
  pid = 1234

  stdoutData(chunk: string): void {
    this.stdout.emit('data', Buffer.from(chunk))
  }

  stderrData(chunk: string): void {
    this.stderr.emit('data', Buffer.from(chunk))
  }

  complete(code: number | null): void {
    this.emit('exit', code, null)
    this.emit('close', code, null)
  }

  fail(err: Error): void {
    this.emit('error', err)
  }
}

interface EmittedEvent {
  type: string
  data: Record<string, unknown>
}

function createMockEvents() {
  const emitted: EmittedEvent[] = []
  const events = {
    emitted,
    createEvent: vi.fn((type: string, data: Record<string, unknown> = {}) => ({
      type,
      data,
      timestamp: '2024-01-01T00:00:00.000Z',
    })),
    emit: vi.fn(async (_jobId: string, event: EmittedEvent) => {
      emitted.push({ type: event.type, data: event.data })
    }),
  }
  return events
}

describe('KccRunnerEmbedded', () => {
  let tmpRoot: string
  let runtimePath: string
  let inputPath: string
  let outputPath: string
  let spawnMock: ReturnType<typeof vi.fn>
  let events: ReturnType<typeof createMockEvents>

  beforeEach(async () => {
    tmpRoot = await mkdtemp(join(tmpdir(), 'kcc-embedded-'))
    runtimePath = join(tmpRoot, 'runtime')
    await mkdir(join(runtimePath, 'python'), { recursive: true })
    await writeFile(join(runtimePath, 'python', 'python.exe'), '')
    await mkdir(join(runtimePath, 'kcc'), { recursive: true })
    await writeFile(join(runtimePath, 'kcc', 'kcc-c2e.py'), '')

    inputPath = join(tmpRoot, 'input')
    outputPath = join(tmpRoot, 'output')
    await mkdir(inputPath, { recursive: true })
    await mkdir(outputPath, { recursive: true })

    events = createMockEvents()
    spawnMock = vi.fn(() => new FakeChild())
  })

  afterEach(async () => {
    await rm(tmpRoot, { recursive: true, force: true })
    vi.clearAllMocks()
  })

  function buildRunner(runtimeOverride?: string): KccRunnerEmbedded {
    return new KccRunnerEmbedded({
      events: events as any,
      runtimePath: runtimeOverride ?? runtimePath,
      spawn: spawnMock as any,
    })
  }

  async function spawnedChild(): Promise<FakeChild> {
    await vi.waitFor(() => {
      expect(spawnMock).toHaveBeenCalled()
    })
    const result = spawnMock.mock.results[0]
    expect(result).toBeDefined()
    return result.value as FakeChild
  }

  it('run: sucesso — exit 0, progresso 50%, started/finished, arquivo detectado', async () => {
    const runner = buildRunner()
    const outputFile = 'meu-manga.epub'
    const content = 'HELLO-KCC'
    await writeFile(join(outputPath, outputFile), Buffer.from(content))

    const runPromise = runner.run('job_001', { mangaMode: true }, 'K11', 'EPUB', inputPath, outputPath, 'Meu Manga')
    const child = await spawnedChild()

    child.stdoutData('Processing... 50%')
    child.complete(0)

    const result = await runPromise

    expect(result.success).toBe(true)
    expect(result.exitCode).toBe(0)
    expect(result.outputPath).toBe(outputPath)
    expect(result.outputFile).toBe(outputFile)
    expect(result.outputSize).toBe(Buffer.byteLength(content))

    const types = events.emitted.map((e) => e.type)
    expect(types).toContain('conversion.started')
    expect(types).toContain('conversion.progress')
    expect(types).toContain('conversion.finished')
    expect(types.indexOf('conversion.started')).toBeLessThan(types.indexOf('conversion.finished'))

    const started = events.emitted.find((e) => e.type === 'conversion.started')
    expect(started?.data).toMatchObject({ deviceId: 'K11', format: 'EPUB', title: 'Meu Manga' })

    const progress = events.emitted.find((e) => e.type === 'conversion.progress')
    expect(progress?.data.progress).toBe(50)

    const finished = events.emitted.find((e) => e.type === 'conversion.finished')
    expect(finished?.data).toMatchObject({ outputFile, outputSize: Buffer.byteLength(content) })
  })

  it('run: falha — exit 1 com stderr "boom" → rejeita KccExecutionError', async () => {
    const runner = buildRunner()

    const runPromise = runner.run('job_001', {}, 'K11', 'EPUB', inputPath, outputPath, 'Titulo')
    const child = await spawnedChild()

    child.stderrData('boom: falha catastrófica')
    child.complete(1)

    const error = await runPromise.catch((e: unknown) => e)
    expect(error).toBeInstanceOf(KccExecutionError)
    expect((error as KccExecutionError).code).toBe('KCC_EXECUTION_ERROR')
    expect((error as Error).message).toContain('boom')
  })

  it('runtimePath vazio → erro claro ANTES de spawnar', async () => {
    const runner = buildRunner('')

    const runPromise = runner.run('job_001', {}, 'K11', 'EPUB', inputPath, outputPath, 'Titulo')

    await expect(runPromise).rejects.toThrow('MI_EMBEDDED_RUNTIME_PATH não configurado')
    expect(spawnMock).not.toHaveBeenCalled()
  })

  it('python.exe inexistente no runtime → erro claro ANTES de spawnar', async () => {
    const badRuntime = join(tmpRoot, 'no-python')
    await mkdir(badRuntime, { recursive: true })
    const runner = buildRunner(badRuntime)

    const runPromise = runner.run('job_001', {}, 'K11', 'EPUB', inputPath, outputPath, 'Titulo')

    await expect(runPromise).rejects.toThrow('Python embutido não encontrado')
    expect(spawnMock).not.toHaveBeenCalled()
  })

  it('wrapper kcc-c2e.py inexistente no runtime → erro claro ANTES de spawnar', async () => {
    const noWrapper = join(tmpRoot, 'no-wrapper')
    await mkdir(join(noWrapper, 'python'), { recursive: true })
    await writeFile(join(noWrapper, 'python', 'python.exe'), '')
    const runner = buildRunner(noWrapper)

    const runPromise = runner.run('job_001', {}, 'K11', 'EPUB', inputPath, outputPath, 'Titulo')

    await expect(runPromise).rejects.toThrow('kcc-c2e.py')
    expect(spawnMock).not.toHaveBeenCalled()
  })

  it('argv/env corretos: python.exe + wrapper kcc-c2e.py + flags KCC + PYTHONPATH/PATH', async () => {
    const runner = buildRunner()

    const runPromise = runner.run('job_001', { mangaMode: true, cropping: 'margins' }, 'K11', 'EPUB', inputPath, outputPath, 'Meu Manga')

    await spawnedChild()
    const call = spawnMock.mock.calls[0] as [string, string[], Record<string, unknown>]
    const [cmd, argv, options] = call

    expect(cmd).toBe(join(runtimePath, 'python', 'python.exe'))
    // O wrapper kcc-c2e.py encapsula o startC2E (com guard __main__ +
    // set_start_method('spawn')) — argv[0] é o script, não `-c`/startC2E.
    expect(argv[0]).toBe(join(runtimePath, 'kcc', 'kcc-c2e.py'))
    expect(argv[1]).toBe('-m')
    expect(argv).not.toContain('startC2E')

    // Flags do KCC com paths do HOST
    expect(argv).toContain('-m')
    expect(argv).toContain('-c')
    expect(argv).toContain('-p')
    expect(argv).toContain('K11')
    expect(argv).toContain('-f')
    expect(argv).toContain('EPUB')
    expect(argv).toContain('-o')
    expect(argv[argv.indexOf('-o') + 1]).toBe(outputPath)
    expect(argv).toContain(inputPath)

    // Env do child
    const env = options.env as Record<string, string>
    expect(env.PYTHONPATH).toBe(join(runtimePath, 'kcc'))
    expect(env.PATH).toContain(join(runtimePath, 'kindlegen'))
    expect(options.windowsHide).toBe(true)

    // Resolve limpo: cria output e completa com sucesso
    await writeFile(join(outputPath, 'meu-manga.epub'), Buffer.from('X'))
    const child = await spawnedChild()
    child.complete(0)
    await runPromise
  })

  it('KccRunnerService e KccRunnerEmbedded implementam IKccRunner', () => {
    const assertImplements = (_runner: IKccRunner): void => {}

    assertImplements(new KccRunnerService(events as any))
    assertImplements(buildRunner())

    const service: IKccRunner = new KccRunnerService(events as any)
    const embedded: IKccRunner = buildRunner()
    expect(typeof service.run).toBe('function')
    expect(typeof embedded.run).toBe('function')
  })

  it('child error → rejeita com o erro do spawn', async () => {
    const runner = buildRunner()

    const runPromise = runner.run('job_001', {}, 'K11', 'EPUB', inputPath, outputPath, 'Titulo')
    const child = await spawnedChild()

    child.fail(new Error('ENOENT: spawn python.exe ENOENT'))

    await expect(runPromise).rejects.toThrow('ENOENT')
  })
})
