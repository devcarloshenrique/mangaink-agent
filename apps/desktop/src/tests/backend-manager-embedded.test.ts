import { execFile, spawn } from 'node:child_process'
import { EventEmitter } from 'node:events'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createBackendManager, type BackendManager, type BackendManagerDeps, type BackendState } from '../main/backend-manager'
import { PostgresManagerError, type PostgresManager } from '../main/postgres-manager'
import type { SettingsStore } from '../main/settings-store'

const RESOURCES_BACKEND_PATH = path.resolve('apps/backend')

const TEST_SETTINGS = {
  backendPort: 3333,
  databaseUrl: 'postgresql://mangaink:mangaink@localhost:5432/mangaink_agent_db',
  redisUrl: 'redis://localhost:6379',
  jwtSecret: 'a'.repeat(64),
}

const FAKE_DB_URL = 'postgresql://postgres@127.0.0.1:55432/mangaink_agent_db'

function createSettingsStub(): SettingsStore {
  return {
    get: () => ({ ...TEST_SETTINGS }),
    load: async () => ({ ...TEST_SETTINGS }),
    save: async () => undefined,
    getManagedPostgresPort: () => undefined,
    setManagedPostgresPort: async () => undefined,
  } as SettingsStore
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

interface SpawnCall {
  cmd: string
  args: string[]
  options: Record<string, unknown>
  child: FakeChild
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

interface FakePostgres {
  start: ReturnType<typeof vi.fn>
  stop: ReturnType<typeof vi.fn>
  getDatabaseUrl: ReturnType<typeof vi.fn>
  getPort: ReturnType<typeof vi.fn>
  isRunning: ReturnType<typeof vi.fn>
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

function createFakePostgres(): FakePostgres {
  return {
    start: vi.fn(async () => undefined),
    stop: vi.fn(async () => undefined),
    getDatabaseUrl: vi.fn(() => FAKE_DB_URL),
    getPort: vi.fn(() => 55432),
    isRunning: vi.fn(() => true),
  }
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

function buildEmbeddedManager(mocks: SpawnMocks, postgres: PostgresManager, overrides: Partial<BackendManagerDeps> = {}): BackendManager {
  return buildManager(mocks, { embedded: true, postgres, ...overrides })
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

describe('backend-manager (modo embedded)', () => {
  let mocks: SpawnMocks

  beforeEach(() => {
    vi.useFakeTimers()
    mocks = createSpawnMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('embedded: postgres.start é chamado, preflight docker NÃO roda, migrations e backend usam DATABASE_URL do postgres, backend sem REDIS_URL e com MI_EMBEDDED_MODE=1 → ready', async () => {
    mocks.fetch.mockResolvedValue(healthOkResponse())
    const postgres = createFakePostgres()
    const manager = buildEmbeddedManager(mocks, postgres, { runtimePath: 'C:\\runtime\\embedded' })

    await manager.start()
    await vi.advanceTimersByTimeAsync(500)

    expect(postgres.start).toHaveBeenCalledTimes(1)
    expect(mocks.execFile).not.toHaveBeenCalled()

    const migrationCall = mocks.spawnCalls.find((c) => c.args.includes('migrate'))
    expect(migrationCall).toBeDefined()
    expect((migrationCall?.options.env as Record<string, string>).DATABASE_URL).toBe(FAKE_DB_URL)

    const apiCall = apiSpawnCall(mocks)
    const env = apiCall.options.env as Record<string, string>
    expect(env.PORT).toBe(String(TEST_SETTINGS.backendPort))
    expect(env.JWT_SECRET).toBe(TEST_SETTINGS.jwtSecret)
    expect(env.DATABASE_URL).toBe(FAKE_DB_URL)
    expect(env.MI_EMBEDDED_MODE).toBe('1')
    expect(env.MI_EMBEDDED_RUNTIME_PATH).toBe('C:\\runtime\\embedded')
    expect(env.MI_DESKTOP_MANAGED).toBe('1')
    expect(env.OTEL_SDK_DISABLED).toBe('true')
    expect(env.REDIS_URL).toBeUndefined()

    expect(postgres.getDatabaseUrl).toHaveBeenCalled()
    expect(manager.getState().status).toBe('ready')
  })

  it('embedded sem runtimePath: backend sobe sem MI_EMBEDDED_RUNTIME_PATH (não força env inexistente)', async () => {
    mocks.fetch.mockResolvedValue(healthOkResponse())
    const postgres = createFakePostgres()
    const manager = buildEmbeddedManager(mocks, postgres)

    await manager.start()
    await vi.advanceTimersByTimeAsync(500)

    const env = apiSpawnCall(mocks).options.env as Record<string, string>
    expect(env.MI_EMBEDDED_MODE).toBe('1')
    expect(env.MI_EMBEDDED_RUNTIME_PATH).toBeUndefined()
    expect(manager.getState().status).toBe('ready')
  })

  it('embedded: postgres.start rejeita com PostgresManagerError → postgres_failed com stderr e nenhum spawn; restart tenta de novo e atinge ready', async () => {
    mocks.fetch.mockResolvedValue(healthOkResponse())
    const postgres = createFakePostgres()
    postgres.start
      .mockRejectedValueOnce(new PostgresManagerError('boom', 'stderr-detailed'))
      .mockResolvedValueOnce(undefined)
    const manager = buildEmbeddedManager(mocks, postgres)

    await manager.start()

    const failed = expectState(manager.getState(), 'postgres_failed')
    expect(failed.message).toContain('boom')
    expect(failed.stderr).toContain('stderr-detailed')
    expect(mocks.spawn).not.toHaveBeenCalled()
    expect(mocks.fetch).not.toHaveBeenCalled()
    expect(postgres.stop).not.toHaveBeenCalled()

    await manager.restart()
    await vi.advanceTimersByTimeAsync(500)

    expect(postgres.start).toHaveBeenCalledTimes(2)
    expect(manager.getState().status).toBe('ready')
    expect(apiSpawnCall(mocks)).toBeDefined()
  })

  it('web (embedded false, default): preflight docker roda, DATABASE_URL e REDIS_URL vêm do settings, sem MI_EMBEDDED_MODE', async () => {
    mocks.fetch.mockResolvedValue(healthOkResponse())
    const postgres = createFakePostgres()
    const manager = buildManager(mocks, { postgres })

    await manager.start()
    await vi.advanceTimersByTimeAsync(500)

    expect(mocks.execFile).toHaveBeenCalledWith('docker', ['version'], expect.any(Function))
    expect(postgres.start).not.toHaveBeenCalled()
    expect(postgres.stop).not.toHaveBeenCalled()

    const env = apiSpawnCall(mocks).options.env as Record<string, string>
    expect(env.DATABASE_URL).toBe(TEST_SETTINGS.databaseUrl)
    expect(env.REDIS_URL).toBe(TEST_SETTINGS.redisUrl)
    expect(env.MI_EMBEDDED_MODE).toBeUndefined()
    expect(manager.getState().status).toBe('ready')
  })

  it('stop() embedded: backend parado e postgres.stop chamado', async () => {
    mocks.fetch.mockResolvedValue(healthOkResponse())
    const postgres = createFakePostgres()
    const manager = buildEmbeddedManager(mocks, postgres)

    await manager.start()
    await vi.advanceTimersByTimeAsync(500)
    expect(manager.getState().status).toBe('ready')

    const child = apiSpawnCall(mocks).child

    await manager.stop()

    expect(child.killedSignals).toContain('SIGTERM')
    expect(postgres.stop).toHaveBeenCalledTimes(1)
    expect(manager.getState().status).toBe('idle')
  })

  it('stop() web: postgres.stop NÃO é chamado', async () => {
    mocks.fetch.mockResolvedValue(healthOkResponse())
    const postgres = createFakePostgres()
    const manager = buildManager(mocks, { postgres })

    await manager.start()
    await vi.advanceTimersByTimeAsync(500)

    await manager.stop()

    expect(postgres.stop).not.toHaveBeenCalled()
  })

  it('embedded:true sem a dep postgres → start() rejeita com erro claro', async () => {
    mocks.fetch.mockResolvedValue(healthOkResponse())
    const manager = buildManager(mocks, { embedded: true })

    await expect(manager.start()).rejects.toThrow(/postgres/i)
  })

  it('embedded: postgres.start lança erro genérico (não PostgresManagerError) → postgres_failed com mensagem no stderr', async () => {
    mocks.fetch.mockResolvedValue(healthOkResponse())
    const postgres = createFakePostgres()
    postgres.start.mockRejectedValueOnce(new Error('EACCES: permission denied'))
    const manager = buildEmbeddedManager(mocks, postgres)

    await manager.start()

    const failed = expectState(manager.getState(), 'postgres_failed')
    expect(failed.message).toBeDefined()
    expect(failed.stderr).toContain('EACCES')
    expect(mocks.spawn).not.toHaveBeenCalled()
  })
})
