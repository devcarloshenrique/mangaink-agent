import { EventEmitter } from 'node:events'
import { mkdtemp, mkdir, rm, stat, writeFile, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  MobiUnpackRunnerService,
  type MobiUnpackRunner,
} from '../../services/mobi-unpack-runner.service'
import { MobiUnpackRunnerEmbedded } from '../../services/mobi-unpack-runner-embedded.service'

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

describe('MobiUnpackRunnerEmbedded', () => {
  let tmpRoot: string
  let runtimePath: string
  let mobiPath: string
  let outputDir: string
  let spawnMock: ReturnType<typeof vi.fn>

  const imagesDir = (): string => join(outputDir, 'images')

  beforeEach(async () => {
    tmpRoot = await mkdtemp(join(tmpdir(), 'mobi-unpack-embedded-'))
    runtimePath = join(tmpRoot, 'runtime')
    await mkdir(join(runtimePath, 'python'), { recursive: true })
    await writeFile(join(runtimePath, 'python', 'python.exe'), '')
    await writeFile(join(runtimePath, 'extract_mobi.py'), '')

    mobiPath = join(tmpRoot, 'obra.mobi')
    await writeFile(mobiPath, 'fake mobi')

    outputDir = join(tmpRoot, 'output')
    spawnMock = vi.fn(() => new FakeChild())
  })

  afterEach(async () => {
    await rm(tmpRoot, { recursive: true, force: true })
    vi.clearAllMocks()
  })

  function buildRunner(runtimeOverride?: string): MobiUnpackRunnerEmbedded {
    return new MobiUnpackRunnerEmbedded({
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

  it('sucesso: exit 0 resolve, mkdir do outputDir, argv correto sem duplicar binário', async () => {
    const runner = buildRunner()

    const runPromise = runner.run({
      jobId: 'job_001',
      mobiPath,
      outputDir,
    })

    const child = await spawnedChild()

    // outputDir criado antes do spawn
    await expect(stat(outputDir)).resolves.toBeDefined()

    const [cmd, argv, options] = spawnMock.mock.calls[0] as [string, string[], Record<string, unknown>]
    const pythonBin = join(runtimePath, 'python', 'python.exe')
    expect(cmd).toBe(pythonBin)
    // argv[0] é o script — NÃO o binário (sem duplicação)
    expect(argv[0]).not.toBe(cmd)
    expect(argv).toEqual([join(runtimePath, 'extract_mobi.py'), mobiPath, outputDir])
    expect(options.windowsHide).toBe(true)
    expect((options.env as Record<string, string>).PYTHONPATH).toBe(runtimePath)

    child.stdoutData('extraindo pagina 1')
    child.complete(0)

    await expect(runPromise).resolves.toBeUndefined()
  })

  it('onTick: contagens crescentes conforme imagens aparecem em outputDir/images', async () => {
    const runner = buildRunner()
    await mkdir(imagesDir(), { recursive: true })

    const seen: number[] = []
    const onTick = vi.fn(async () => {
      const entries = await readdir(imagesDir()).catch(() => [] as string[])
      seen.push(entries.filter((f) => /\.(jpg|jpeg|png|gif|bmp|webp|avif)$/i.test(f)).length)
    })

    const runPromise = runner.run({
      jobId: 'job_002',
      mobiPath,
      outputDir,
      onTick,
      pollIntervalMs: 30,
    })

    await spawnedChild()

    await writeFile(join(imagesDir(), '0001.png'), 'x')
    await vi.waitFor(() => {
      expect(seen).toContain(1)
    })

    await writeFile(join(imagesDir(), '0002.jpg'), 'x')
    await vi.waitFor(() => {
      expect(seen).toContain(2)
    })

    const child = spawnMock.mock.results[0].value as FakeChild
    child.complete(0)
    await runPromise

    expect(seen[seen.length - 1]).toBe(2)
    for (let i = 1; i < seen.length; i++) {
      expect(seen[i]).toBeGreaterThan(seen[i - 1])
    }
    expect(onTick).toHaveBeenCalled()
  })

  it('falha: exit 1 com stderr "boom" → reject com "boom" na mensagem', async () => {
    const runner = buildRunner()

    const runPromise = runner.run({
      jobId: 'job_003',
      mobiPath,
      outputDir,
    })

    const child = await spawnedChild()
    child.stderrData('boom: extracao falhou')
    child.complete(1)

    const error = await runPromise.catch((e: unknown) => e)
    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).toContain('boom')
    expect((error as Error).message).toContain('mobi-unpack exited 1')
  })

  it('runtimePath vazio → erro claro ANTES de spawnar', async () => {
    const runner = buildRunner('')

    const runPromise = runner.run({
      jobId: 'job_004',
      mobiPath,
      outputDir,
    })

    await expect(runPromise).rejects.toThrow('MI_EMBEDDED_RUNTIME_PATH não configurado')
    expect(spawnMock).not.toHaveBeenCalled()
  })

  it('python.exe ausente → erro claro ANTES de spawnar', async () => {
    const badRuntime = join(tmpRoot, 'no-python')
    await mkdir(badRuntime, { recursive: true })
    const runner = buildRunner(badRuntime)

    const runPromise = runner.run({
      jobId: 'job_005',
      mobiPath,
      outputDir,
    })

    await expect(runPromise).rejects.toThrow('Python embutido não encontrado')
    expect(spawnMock).not.toHaveBeenCalled()
  })

  it('extract_mobi.py ausente → erro claro ANTES de spawnar', async () => {
    const badRuntime = join(tmpRoot, 'no-script')
    await mkdir(join(badRuntime, 'python'), { recursive: true })
    await writeFile(join(badRuntime, 'python', 'python.exe'), '')
    const runner = buildRunner(badRuntime)

    const runPromise = runner.run({
      jobId: 'job_006',
      mobiPath,
      outputDir,
    })

    await expect(runPromise).rejects.toThrow('extract_mobi.py')
    expect(spawnMock).not.toHaveBeenCalled()
  })

  it('child error → rejeita com o erro do spawn', async () => {
    const runner = buildRunner()

    const runPromise = runner.run({
      jobId: 'job_007',
      mobiPath,
      outputDir,
    })

    const child = await spawnedChild()
    child.fail(new Error('ENOENT: spawn python.exe ENOENT'))

    await expect(runPromise).rejects.toThrow('ENOENT')
  })

  it('MobiUnpackRunnerEmbedded satisfaz MobiUnpackRunner', () => {
    const assertImplements = (_runner: MobiUnpackRunner): void => {}

    assertImplements(new MobiUnpackRunnerService())
    assertImplements(buildRunner())

    const service: MobiUnpackRunner = new MobiUnpackRunnerService()
    const embedded: MobiUnpackRunner = buildRunner()
    expect(typeof service.run).toBe('function')
    expect(typeof embedded.run).toBe('function')
  })
})
