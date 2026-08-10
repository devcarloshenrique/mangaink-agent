import { execFile, spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { EventEmitter } from 'node:events'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createBackendManager,
  type BackendManager,
  type BackendManagerDeps,
  type BackendState,
} from '../main/backend-manager'
import type { SettingsStore } from '../main/settings-store'

const RESOURCES_BACKEND_PATH = path.resolve('apps/backend')

const TEST_SETTINGS = {
  backendPort: 3333,
  databaseUrl: 'postgresql://mangaink:mangaink@localhost:5432/mangaink_agent_db',
  redisUrl: 'redis://localhost:6379',
  jwtSecret: 'a'.repeat(64),
}

function createSettingsStub(): SettingsStore {
  return {
    get: () => ({ ...TEST_SETTINGS }),
    load: async () => ({ ...TEST_SETTINGS }),
    save: async () => undefined,
    getManagedPostgresPort: () => undefined,
    setManagedPostgresPort: async () => undefined,
  } as SettingsStore
}

interface SpawnCall {
  cmd: string
  args: string[]
  options: Record<string, unknown>
  child: FakeChild
}

interface FakeChild {
  pid: number
  stdout: EventEmitter
  stderr: EventEmitter
  killedSignals: string[]
  kill: (signal: string) => boolean
  on: EventEmitter['on']
  once: EventEmitter['once']
  emit: EventEmitter['emit']
}

interface SpawnMocks {
  spawnCalls: SpawnCall[]
  killEmitsExit: boolean
  migrationExitCode: number | null
  migrationStderr: string
  spawn: ReturnType<typeof vi.fn>
  execFile: ReturnType<typeof vi.fn>
  fetch: ReturnType<typeof vi.fn>
}

function createSpawnMocks(): SpawnMocks {
  let pidCounter = 0
  const mocks: SpawnMocks = {
    spawnCalls: [],
    killEmitsExit: true,
    migrationExitCode: 0,
    migrationStderr: '',
    spawn: vi.fn(),
    execFile: vi.fn(),
    fetch: vi.fn(),
  }

  mocks.spawn.mockImplementation((cmd: string, args: string[], options: Record<string, unknown>) => {
    const child = new EventEmitter() as unknown as FakeChild
    child.stdout = new EventEmitter()
    child.stderr = new EventEmitter()
    child.pid = 1000 + pidCounter++
    child.killedSignals = []
    child.kill = (signal: string) => {
      child.killedSignals.push(signal)
      if (mocks.killEmitsExit) {
        queueMicrotask(() => {
          child.emit('exit', 0, signal)
        })
      }
      return true
    }
    mocks.spawnCalls.push({ cmd, args, options, child })

    if (args.includes('migrate')) {
      queueMicrotask(() => {
        if (mocks.migrationStderr !== '') {
          child.stderr.emit('data', Buffer.from(mocks.migrationStderr))
        }
        child.emit('exit', mocks.migrationExitCode, null)
      })
    }

    return child
  })

  mocks.execFile.mockImplementation(
    (cmd: string, _args: string[], cb: (err: Error | null, stdout: string, stderr: string) => void) => {
      cb(null, '', '')
      void cmd
    },
  )

  return mocks
}

function healthOkResponse(): { ok: boolean; status: number; json: () => Promise<{ status: string }> } {
  return { ok: true, status: 200, json: async () => ({ status: 'ok' }) }
}

function buildManager(mocks: SpawnMocks, overrides: Partial<BackendManagerDeps> = {}): BackendManager {
  const deps: BackendManagerDeps = {
    spawn: mocks.spawn as unknown as typeof spawn,
    execFile: mocks.execFile as unknown as typeof execFile,
    fetch: mocks.fetch as unknown as typeof fetch,
    settings: createSettingsStub(),
    resourcesBackendPath: RESOURCES_BACKEND_PATH,
    pollIntervalMs: 500,
    healthTimeoutMs: 30_000,
    killGraceMs: 5_000,
    managedMigrations: true,
    ...overrides,
  }
  return createBackendManager(deps)
}

function apiSpawnCall(mocks: SpawnMocks): SpawnCall {
  const call = mocks.spawnCalls.find((c) => c.args.length > 0 && c.args[0].endsWith('app.js'))
  if (!call) {
    throw new Error('spawn da API não foi chamado')
  }
  return call
}

function expectState<T extends BackendState['status']>(state: BackendState, status: T): Extract<BackendState, { status: T }> {
  if (state.status !== status) {
    throw new Error(`expected status ${status}, got ${state.status}`)
  }
  return state as Extract<BackendState, { status: T }>
}

describe('backend-manager', () => {
  let mocks: SpawnMocks

  beforeEach(() => {
    vi.useFakeTimers()
    mocks = createSpawnMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('start() spawna o backend com env correto (8 overrides) e stdio/shell corretos', async () => {
    mocks.fetch.mockResolvedValue(healthOkResponse())
    const manager = buildManager(mocks)

    await manager.start()

    expect(mocks.spawnCalls.length).toBeGreaterThanOrEqual(2)

    const migrationCall = mocks.spawnCalls.find((c) => c.args.includes('migrate'))
    expect(migrationCall).toBeDefined()
    expect(migrationCall?.cmd).toBe('node')
    expect(migrationCall?.args[0]).toBe(
      path.join(RESOURCES_BACKEND_PATH, 'node_modules', 'prisma', 'build', 'index.js'),
    )
    expect(migrationCall?.options.cwd).toBe(RESOURCES_BACKEND_PATH)
    expect((migrationCall?.options.env as Record<string, string>).DATABASE_URL).toBe(TEST_SETTINGS.databaseUrl)

    const apiCall = apiSpawnCall(mocks)
    expect(apiCall.cmd).toBe('node')
    expect(apiCall.args).toEqual([path.join(RESOURCES_BACKEND_PATH, 'dist', 'app.js')])
    expect(apiCall.options.cwd).toBe(RESOURCES_BACKEND_PATH)

    const env = apiCall.options.env as Record<string, string>
    expect(env.PORT).toBe(String(TEST_SETTINGS.backendPort))
    expect(env.JWT_SECRET).toBe(TEST_SETTINGS.jwtSecret)
    expect(env.DATABASE_URL).toBe(TEST_SETTINGS.databaseUrl)
    expect(env.REDIS_URL).toBe(TEST_SETTINGS.redisUrl)
    expect(env.OTEL_SDK_DISABLED).toBe('true')
    expect(env.MI_DESKTOP_MANAGED).toBe('1')

    expect(apiCall.options.stdio).toEqual(['ignore', 'pipe', 'pipe'])
    expect(apiCall.options.shell).toBeUndefined()
    expect(apiCall.options.env).toEqual(expect.objectContaining(process.env))
  })

  it('STORAGE_PATH default deriva de resourcesBackendPath e storagePath injetado sobrepõe', async () => {
    mocks.fetch.mockResolvedValue(healthOkResponse())

    const defaultManager = buildManager(mocks)
    await defaultManager.start()
    const defaultEnv = apiSpawnCall(mocks).options.env as Record<string, string>
    expect(defaultEnv.STORAGE_PATH).toBe(path.resolve(path.join(RESOURCES_BACKEND_PATH, '..', 'storage')))
    expect(defaultEnv.CONVERSIONS_STORAGE_PATH).toBe(
      path.join(path.resolve(path.join(RESOURCES_BACKEND_PATH, '..', 'storage')), 'conversions'),
    )

    mocks.spawnCalls.length = 0
    const customManager = buildManager(mocks, { storagePath: path.resolve('/custom/storage') })
    await customManager.start()
    const customEnv = apiSpawnCall(mocks).options.env as Record<string, string>
    expect(customEnv.STORAGE_PATH).toBe(path.resolve('/custom/storage'))
    expect(customEnv.CONVERSIONS_STORAGE_PATH).toBe(path.join(path.resolve('/custom/storage'), 'conversions'))
  })

  it('health poll: backend fica ready no 2º poll e o poll é interrompido', async () => {
    let calls = 0
    mocks.fetch.mockImplementation(async () => {
      calls += 1
      if (calls === 1) {
        throw new Error('conexão recusada')
      }
      return healthOkResponse()
    })
    const manager = buildManager(mocks, { managedMigrations: false })

    await manager.start()
    expect(manager.getState().status).toBe('starting')

    await vi.advanceTimersByTimeAsync(500)
    expect(manager.getState().status).toBe('ready')
    expect(calls).toBe(2)

    await vi.advanceTimersByTimeAsync(2_000)
    expect(calls).toBe(2)
  })

  it('health poll: timeout em healthTimeoutMs leva a backend_failed com mensagem', async () => {
    mocks.fetch.mockRejectedValue(new Error('conexão recusada'))
    const manager = buildManager(mocks, { managedMigrations: false, healthTimeoutMs: 3_000 })

    await manager.start()

    await vi.advanceTimersByTimeAsync(3_000)
    const state = expectState(manager.getState(), 'backend_failed')
    expect(state.message).toContain('não respondeu')
  })

  it('exit do child antes do ready → backend_failed com stderr capturado', async () => {
    mocks.fetch.mockRejectedValue(new Error('conexão recusada'))
    const manager = buildManager(mocks, { managedMigrations: false })

    await manager.start()

    const apiCall = apiSpawnCall(mocks)
    apiCall.child.stderr.emit('data', Buffer.from('ERRO: conexão recusada no Postgres'))
    apiCall.child.emit('exit', 1, null)

    const state = expectState(manager.getState(), 'backend_failed')
    expect(state.message).toContain('exit')
    expect(state.stderr).toContain('ERRO: conexão recusada no Postgres')
    expect(manager.getLogs().stderr).toContain('ERRO: conexão recusada no Postgres')
  })

  it('restart() encerra o child anterior, spawna novo e volta a ready', async () => {
    mocks.fetch.mockResolvedValue(healthOkResponse())
    const manager = buildManager(mocks, { managedMigrations: false })

    await manager.start()
    await vi.advanceTimersByTimeAsync(500)
    expect(manager.getState().status).toBe('ready')

    const firstChild = apiSpawnCall(mocks).child

    const transitions: string[] = []
    const unsubscribe = manager.onStateChange((s) => transitions.push(s.status))

    await manager.restart()
    await vi.advanceTimersByTimeAsync(500)

    expect(firstChild.killedSignals).toContain('SIGTERM')
    expect(mocks.spawnCalls.filter((c) => c.args[0].endsWith('app.js')).length).toBe(2)
    expect(manager.getState().status).toBe('ready')
    expect(transitions).toContain('starting')
    expect(transitions).toContain('ready')
    unsubscribe()
  })

  it('stop(): SIGTERM → grace → SIGKILL, e limpa timers do poll', async () => {
    mocks.fetch.mockRejectedValue(new Error('conexão recusada'))
    mocks.killEmitsExit = false
    const manager = buildManager(mocks, { managedMigrations: false, killGraceMs: 1_000 })

    await manager.start()
    const child = apiSpawnCall(mocks).child
    const fetchCallsBefore = mocks.fetch.mock.calls.length

    const stopPromise = manager.stop()

    expect(child.killedSignals).toEqual(['SIGTERM'])

    await vi.advanceTimersByTimeAsync(1_000)
    await stopPromise

    expect(child.killedSignals).toEqual(['SIGTERM', 'SIGKILL'])

    await vi.advanceTimersByTimeAsync(2_000)
    expect(mocks.fetch.mock.calls.length).toBe(fetchCallsBefore)
    expect(manager.getState().status).toBe('idle')
  })

  it('preflight: docker version falha → prereq_failed e spawn nunca é chamado', async () => {
    mocks.execFile.mockImplementation(
      (cmd: string, _args: string[], cb: (err: Error | null, stdout: string, stderr: string) => void) => {
        cb(new Error('docker not found'), '', '')
        void cmd
      },
    )
    mocks.fetch.mockResolvedValue(healthOkResponse())
    const manager = buildManager(mocks)

    await manager.start()

    expect(mocks.execFile).toHaveBeenCalledWith('docker', ['version'], expect.any(Function))
    const state = expectState(manager.getState(), 'prereq_failed')
    expect(state.message).toContain('Docker')
    expect(mocks.spawn).not.toHaveBeenCalled()
    expect(mocks.fetch).not.toHaveBeenCalled()
  })

  it('migrations falham → migration_failed com stderr; API nunca spawnada', async () => {
    mocks.migrationExitCode = 1
    mocks.migrationStderr = 'Prisma Migrate failed: connection refused'
    mocks.fetch.mockResolvedValue(healthOkResponse())
    const manager = buildManager(mocks)

    await manager.start()

    const state = expectState(manager.getState(), 'migration_failed')
    expect(state.stderr).toContain('Prisma Migrate failed')
    expect(manager.getLogs().stderr).toContain('Prisma Migrate failed')
    expect(mocks.spawnCalls.length).toBe(1)
    expect(mocks.spawnCalls[0].args.includes('migrate')).toBe(true)
    expect(mocks.spawnCalls[0].args[0].includes('app.js')).toBe(false)
    expect(mocks.spawn).toHaveBeenCalledTimes(1)
  })

  it('managedMigrations: false pula migrations e spawna a API direto', async () => {
    mocks.fetch.mockResolvedValue(healthOkResponse())
    const manager = buildManager(mocks, { managedMigrations: false })

    await manager.start()

    expect(mocks.spawnCalls.length).toBe(1)
    expect(mocks.spawnCalls[0].args.includes('migrate')).toBe(false)
    expect(mocks.spawnCalls[0].args[0].endsWith('app.js')).toBe(true)
  })

  it('migrationsMarkerPath ausente: migrate deploy roda em toda abertura (comportamento atual)', async () => {
    mocks.fetch.mockResolvedValue(healthOkResponse())
    const manager = buildManager(mocks)

    await manager.start()

    const migrationCalls = mocks.spawnCalls.filter((c) => c.args.includes('migrate'))
    expect(migrationCalls.length).toBe(1)
  })

  it('migrationsMarkerPath com hash atual: pula o migrate deploy (boot mais rápido)', async () => {
    mocks.fetch.mockResolvedValue(healthOkResponse())
    const fakeBackend = mkdtempSync(path.join(tmpdir(), 'mi-backend-'))
    const migrationsDir = path.join(fakeBackend, 'prisma', 'migrations')
    mkdirSync(path.join(migrationsDir, '0001_init'), { recursive: true })
    writeFileSync(path.join(migrationsDir, '0001_init', 'migration.sql'), 'CREATE TABLE x;')

    const hash = createHash('sha256')
    hash.update(path.join('0001_init', 'migration.sql'))
    const markerPath = path.join(tmpdir(), `mi-marker-${Date.now()}-${Math.random()}.txt`)
    writeFileSync(markerPath, hash.digest('hex'))

    try {
      const manager = buildManager(mocks, { resourcesBackendPath: fakeBackend, migrationsMarkerPath: markerPath })

      await manager.start()
      await vi.advanceTimersByTimeAsync(500)

      const migrationCalls = mocks.spawnCalls.filter((c) => c.args.includes('migrate'))
      expect(migrationCalls.length).toBe(0)
      expect(apiSpawnCall(mocks)).toBeDefined()
      expect(manager.getState().status).toBe('ready')
    } finally {
      rmSync(fakeBackend, { recursive: true, force: true })
      rmSync(markerPath, { force: true })
    }
  })

  it('migrationsMarkerPath com hash divergente: migrate deploy roda e o marker é atualizado', async () => {
    mocks.fetch.mockResolvedValue(healthOkResponse())
    const fakeBackend = mkdtempSync(path.join(tmpdir(), 'mi-backend-'))
    const migrationsDir = path.join(fakeBackend, 'prisma', 'migrations')
    mkdirSync(path.join(migrationsDir, '0001_init'), { recursive: true })
    writeFileSync(path.join(migrationsDir, '0001_init', 'migration.sql'), 'CREATE TABLE x;')

    const markerPath = path.join(tmpdir(), `mi-marker-${Date.now()}-${Math.random()}.txt`)
    writeFileSync(markerPath, 'hash-antigo')

    try {
      const manager = buildManager(mocks, { resourcesBackendPath: fakeBackend, migrationsMarkerPath: markerPath })

      await manager.start()

      const migrationCalls = mocks.spawnCalls.filter((c) => c.args.includes('migrate'))
      expect(migrationCalls.length).toBe(1)
      expect(apiSpawnCall(mocks)).toBeDefined()

      const persisted = readFileSync(markerPath, 'utf8')
      const expected = createHash('sha256')
      expected.update(path.join('0001_init', 'migration.sql'))
      expect(persisted).toBe(expected.digest('hex'))
    } finally {
      rmSync(fakeBackend, { recursive: true, force: true })
      rmSync(markerPath, { force: true })
    }
  })

  it('backendPort() injetado é usado no PORT e no health poll', async () => {
    mocks.fetch.mockResolvedValue(healthOkResponse())
    const manager = buildManager(mocks, { managedMigrations: false, backendPort: async () => 4444 })

    await manager.start()

    expect((apiSpawnCall(mocks).options.env as Record<string, string>).PORT).toBe('4444')
    expect(mocks.fetch).toHaveBeenCalledWith('http://127.0.0.1:4444/api/health')
  })

  it('stop() é idempotente (noop) quando o backend nunca foi iniciado', async () => {
    const manager = buildManager(mocks, { managedMigrations: false })

    await expect(manager.stop()).resolves.toBeUndefined()
    expect(manager.getState().status).toBe('idle')
  })

  it('nodeBin custom (ex.: process.execPath) → migrations e backend usam nodeBin e env com ELECTRON_RUN_AS_NODE=1', async () => {
    mocks.fetch.mockResolvedValue(healthOkResponse())
    const nodeBin = 'C:\\app\\MangaInk Agent.exe'
    const manager = buildManager(mocks, { nodeBin })

    await manager.start()

    expect(mocks.spawnCalls.length).toBeGreaterThanOrEqual(2)

    const migrationCall = mocks.spawnCalls.find((c) => c.args.includes('migrate'))
    expect(migrationCall).toBeDefined()
    expect(migrationCall?.cmd).toBe(nodeBin)
    expect((migrationCall?.options.env as Record<string, string>).ELECTRON_RUN_AS_NODE).toBe('1')

    const apiCall = apiSpawnCall(mocks)
    expect(apiCall.cmd).toBe(nodeBin)
    const apiEnv = apiCall.options.env as Record<string, string>
    expect(apiEnv.ELECTRON_RUN_AS_NODE).toBe('1')
    expect(apiEnv.PORT).toBe(String(TEST_SETTINGS.backendPort))
    expect(apiEnv.DATABASE_URL).toBe(TEST_SETTINGS.databaseUrl)
  })

  it('nodeBin default (node) → spawns usam node e env SEM ELECTRON_RUN_AS_NODE', async () => {
    mocks.fetch.mockResolvedValue(healthOkResponse())
    const manager = buildManager(mocks)

    await manager.start()

    const migrationCall = mocks.spawnCalls.find((c) => c.args.includes('migrate'))
    expect(migrationCall).toBeDefined()
    expect(migrationCall?.cmd).toBe('node')
    expect((migrationCall?.options.env as Record<string, string>).ELECTRON_RUN_AS_NODE).toBeUndefined()

    const apiCall = apiSpawnCall(mocks)
    expect(apiCall.cmd).toBe('node')
    expect((apiCall.options.env as Record<string, string>).ELECTRON_RUN_AS_NODE).toBeUndefined()
  })
})
