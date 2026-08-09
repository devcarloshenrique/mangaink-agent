import { execFile, spawn } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { randomUUID } from 'node:crypto'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path, { join } from 'node:path'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createPostgresManager,
  PostgresManagerError,
  type PostgresManager,
  type PostgresManagerDeps,
} from '../main/postgres-manager'

const tempRoot = join(tmpdir(), `mangaink-postgres-${randomUUID()}`)
const RUNTIME_BIN = join(tempRoot, 'runtime', 'postgres', 'bin')
const DEFAULT_PORT = 55432
const DEFAULT_DB = 'mangaink_agent_db'

type ExecResult = { err: Error | null; stdout: string; stderr: string }

interface FakeChild {
  pid: number
  stdout: EventEmitter
  stderr: EventEmitter
  killedSignals: string[]
  kill: (signal: string) => boolean
  on: EventEmitter['on']
  emit: EventEmitter['emit']
}

interface SpawnCall {
  cmd: string
  args: string[]
  options: Record<string, unknown>
  child: FakeChild
}

interface Mocks {
  execFile: ReturnType<typeof vi.fn>
  execCalls: Array<{ cmd: string; args: string[] }>
  spawn: ReturnType<typeof vi.fn>
  spawnCalls: SpawnCall[]
  setExecRoute: (route: (cmd: string, args: string[]) => ExecResult) => void
  pgCtlExitCode: number
  pgCtlStderr: string
}

function defaultExecRoute(cmd: string, args: string[]): ExecResult {
  const base = path.basename(cmd)
  if (base === 'psql.exe') {
    const sql = args[args.length - 1] ?? ''
    if (sql.includes('pg_database')) return { err: null, stdout: '', stderr: '' }
    return { err: null, stdout: '1', stderr: '' }
  }
  return { err: null, stdout: '', stderr: '' }
}

function createMocks(): Mocks {
  const execCalls: Mocks['execCalls'] = []
  const spawnCalls: SpawnCall[] = []
  let execRoute: (cmd: string, args: string[]) => ExecResult = defaultExecRoute
  let pidCounter = 0

  const execFile = vi.fn(
    (cmd: string, args: string[], cb: (err: Error | null, stdout: string, stderr: string) => void) => {
      execCalls.push({ cmd, args })
      const result = execRoute(cmd, args)
      cb(result.err, result.stdout, result.stderr)
    },
  )

  const spawn = vi.fn((cmd: string, args: string[], options: Record<string, unknown>) => {
    const child = new EventEmitter() as unknown as FakeChild
    child.stdout = new EventEmitter()
    child.stderr = new EventEmitter()
    child.pid = 3000 + pidCounter++
    child.killedSignals = []
    child.kill = () => true
    spawnCalls.push({ cmd, args, options, child })

    if (path.basename(cmd) === 'pg_ctl.exe') {
      queueMicrotask(() => {
        if (mocks.pgCtlStderr !== '') {
          child.stderr.emit('data', Buffer.from(mocks.pgCtlStderr))
        }
        child.emit('exit', mocks.pgCtlExitCode, null)
      })
    }

    return child
  })

  const mocks: Mocks = {
    execFile,
    execCalls,
    spawn,
    spawnCalls,
    setExecRoute(next) {
      execRoute = next
    },
    pgCtlExitCode: 0,
    pgCtlStderr: '',
  }
  return mocks
}

function buildManager(mocks: Mocks, dataDir: string, overrides: Partial<PostgresManagerDeps> = {}): PostgresManager {
  return createPostgresManager({
    execFile: mocks.execFile as unknown as typeof execFile,
    spawn: mocks.spawn as unknown as typeof spawn,
    runtimePostgresBin: RUNTIME_BIN,
    dataDir,
    port: DEFAULT_PORT,
    pollIntervalMs: 20,
    startTimeoutMs: 1_000,
    ...overrides,
  })
}

function execCallsFor(mocks: Mocks, exe: string): Array<{ cmd: string; args: string[] }> {
  return mocks.execCalls.filter((c) => path.basename(c.cmd) === exe)
}

function spawnCallsFor(mocks: Mocks, exe: string): SpawnCall[] {
  return mocks.spawnCalls.filter((c) => path.basename(c.cmd) === exe)
}

async function freshDataDir(label: string): Promise<string> {
  const dir = join(tempRoot, label, 'pgdata')
  await mkdir(dir, { recursive: true })
  return dir
}

describe('postgres-manager', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterAll(async () => {
    await rm(tempRoot, { recursive: true, force: true })
  })

  it('primeiro start: initdb → pg_ctl start → psql check → createdb quando banco ausente; isRunning true e URL correta', async () => {
    const mocks = createMocks()
    const dataDir = await freshDataDir('case1')
    const manager = buildManager(mocks, dataDir)

    await manager.start()
    await manager.start() // idempotente

    const initdb = execCallsFor(mocks, 'initdb.exe')
    expect(initdb).toHaveLength(1)
    expect(initdb[0].args).toEqual(['-D', dataDir, '-U', 'postgres', '--auth=trust', '-E', 'UTF8'])

    const pgCtlStart = spawnCallsFor(mocks, 'pg_ctl.exe').find((c) => c.args.includes('start'))
    expect(pgCtlStart).toBeDefined()
    expect(pgCtlStart?.args).toEqual([
      '-D',
      dataDir,
      '-l',
      path.join(dataDir, 'postgres.log'),
      '-o',
      `-p ${DEFAULT_PORT} -h 127.0.0.1`,
      '-w',
      'start',
    ])
    expect(pgCtlStart?.options.stdio).toEqual(['ignore', 'ignore', 'pipe'])

    const psql = execCallsFor(mocks, 'psql.exe')
    expect(psql.length).toBeGreaterThanOrEqual(2)
    const dbCheck = psql.find((c) => (c.args[c.args.length - 1] ?? '').includes('pg_database'))
    expect(dbCheck).toBeDefined()
    expect(dbCheck?.args).toEqual([
      '-h',
      '127.0.0.1',
      '-p',
      String(DEFAULT_PORT),
      '-U',
      'postgres',
      '-tAc',
      `SELECT 1 FROM pg_database WHERE datname='${DEFAULT_DB}'`,
    ])

    const createdb = execCallsFor(mocks, 'createdb.exe')
    expect(createdb).toHaveLength(1)
    expect(createdb[0].args).toEqual([
      '-h',
      '127.0.0.1',
      '-p',
      String(DEFAULT_PORT),
      '-U',
      'postgres',
      DEFAULT_DB,
    ])

    expect(manager.isRunning()).toBe(true)
    expect(manager.getPort()).toBe(DEFAULT_PORT)
    expect(manager.getDatabaseUrl()).toBe(`postgresql://postgres@127.0.0.1:${DEFAULT_PORT}/${DEFAULT_DB}`)
  })

  it('start com PG_VERSION existente: initdb NÃO é chamado', async () => {
    const mocks = createMocks()
    const dataDir = await freshDataDir('case2')
    await writeFile(join(dataDir, 'PG_VERSION'), '16\n', 'utf-8')
    const manager = buildManager(mocks, dataDir)

    await manager.start()

    expect(execCallsFor(mocks, 'initdb.exe')).toHaveLength(0)
    expect(manager.isRunning()).toBe(true)
  })

  it('porta auto: usa a porta de findFreePort quando port não é injetado', async () => {
    const mocks = createMocks()
    const dataDir = await freshDataDir('case3')
    const manager = buildManager(mocks, dataDir, {
      port: undefined,
      findFreePort: async () => 55444,
    })

    await manager.start()

    expect(manager.getPort()).toBe(55444)
    const pgCtlStart = spawnCallsFor(mocks, 'pg_ctl.exe').find((c) => c.args.includes('start'))
    expect(pgCtlStart?.args).toContain('-p 55444 -h 127.0.0.1')
    expect(manager.getDatabaseUrl()).toBe('postgresql://postgres@127.0.0.1:55444/mangaink_agent_db')
  })

  it('falha do initdb → PostgresManagerError com stderr', async () => {
    const mocks = createMocks()
    mocks.setExecRoute((cmd, args) => {
      if (path.basename(cmd) === 'initdb.exe') {
        return { err: new Error('permission denied'), stdout: '', stderr: 'ERRO: sem permissão em C:\\pgdata' }
      }
      return defaultExecRoute(cmd, args)
    })
    const dataDir = await freshDataDir('case4')
    const manager = buildManager(mocks, dataDir)

    const err = await manager.start().catch((e: unknown) => e)
    expect(err).toBeInstanceOf(PostgresManagerError)
    expect((err as PostgresManagerError).message).toContain('initdb')
    expect((err as PostgresManagerError).stderr).toBe('ERRO: sem permissão em C:\\pgdata')
    expect(manager.isRunning()).toBe(false)
  })

  it('falha do pg_ctl start → PostgresManagerError com stderr', async () => {
    const mocks = createMocks()
    mocks.pgCtlExitCode = 1
    mocks.pgCtlStderr = 'pg_ctl: could not start server'
    const dataDir = await freshDataDir('case5')
    const manager = buildManager(mocks, dataDir)

    const err = await manager.start().catch((e: unknown) => e)
    expect(err).toBeInstanceOf(PostgresManagerError)
    expect((err as PostgresManagerError).message).toContain('pg_ctl')
    expect((err as PostgresManagerError).stderr).toBe('pg_ctl: could not start server')
    expect(manager.isRunning()).toBe(false)
  })

  it('banco já existe: psql devolve 1 → createdb NÃO é chamado', async () => {
    const mocks = createMocks()
    mocks.setExecRoute((cmd, args) => {
      const base = path.basename(cmd)
      if (base === 'psql.exe') {
        const sql = args[args.length - 1] ?? ''
        if (sql.includes('pg_database')) return { err: null, stdout: '1\n', stderr: '' }
        return { err: null, stdout: '1', stderr: '' }
      }
      return defaultExecRoute(cmd, args)
    })
    const dataDir = await freshDataDir('case6')
    const manager = buildManager(mocks, dataDir)

    await manager.start()

    expect(execCallsFor(mocks, 'createdb.exe')).toHaveLength(0)
    expect(manager.isRunning()).toBe(true)
  })

  it('stop: pg_ctl stop com -m fast -w; segundo stop é no-op; stop sem start é no-op', async () => {
    const mocks = createMocks()
    const dataDir = await freshDataDir('case7')
    const manager = buildManager(mocks, dataDir)

    await manager.start()
    expect(manager.isRunning()).toBe(true)

    await manager.stop()
    expect(manager.isRunning()).toBe(false)
    const stopCalls = execCallsFor(mocks, 'pg_ctl.exe').filter((c) => c.args.includes('stop'))
    expect(stopCalls).toHaveLength(1)
    expect(stopCalls[0].args).toEqual(['-D', dataDir, '-m', 'fast', '-w', 'stop'])

    await manager.stop()
    expect(execCallsFor(mocks, 'pg_ctl.exe').filter((c) => c.args.includes('stop'))).toHaveLength(1)

    const mocks2 = createMocks()
    const fresh = buildManager(mocks2, dataDir)
    await fresh.stop()
    expect(execCallsFor(mocks2, 'pg_ctl.exe')).toHaveLength(0)
    expect(fresh.isRunning()).toBe(false)
  })

  it('stop com pg_ctl "not running" no stderr é tolerado (resolve)', async () => {
    const mocks = createMocks()
    mocks.setExecRoute((cmd, args) => {
      if (path.basename(cmd) === 'pg_ctl.exe' && args.includes('stop')) {
        return { err: new Error('exit code 4'), stdout: '', stderr: 'pg_ctl: server does not run' }
      }
      return defaultExecRoute(cmd, args)
    })
    const dataDir = await freshDataDir('case8')
    const manager = buildManager(mocks, dataDir)

    await manager.start()
    await expect(manager.stop()).resolves.toBeUndefined()
    expect(manager.isRunning()).toBe(false)
  })

  it('isRunning reflete o estado entre start e stop', async () => {
    const mocks = createMocks()
    const dataDir = await freshDataDir('case9')
    const manager = buildManager(mocks, dataDir)

    expect(manager.isRunning()).toBe(false)
    await manager.start()
    expect(manager.isRunning()).toBe(true)
    await manager.stop()
    expect(manager.isRunning()).toBe(false)
  })
})
