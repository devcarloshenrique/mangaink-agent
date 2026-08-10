import { execFile, spawn, type ChildProcess } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { PostgresManagerError, type PostgresManager } from './postgres-manager'
import type { SettingsStore } from './settings-store'

export type BackendState =
  | { status: 'idle' }
  | { status: 'starting'; message: string }
  | { status: 'prereq_failed'; message: string; stderr?: string }
  | { status: 'postgres_failed'; message: string; stderr?: string }
  | { status: 'migration_failed'; message: string; stderr: string }
  | { status: 'backend_failed'; message: string; stderr?: string }
  | { status: 'ready'; message: string }

export interface BackendLogs {
  stdout: string
  stderr: string
}

export interface BackendManagerDeps {
  spawn: typeof spawn
  execFile: typeof execFile
  fetch: typeof globalThis.fetch
  settings: SettingsStore
  resourcesBackendPath: string
  storagePath?: string
  /** Raiz do runtime embutido (Postgres/Python/KCC/kindlegen/extract_mobi). Injetada como MI_EMBEDDED_RUNTIME_PATH no backend em modo embedded. */
  runtimePath?: string
  backendPort?: () => Promise<number>
  pollIntervalMs?: number
  healthTimeoutMs?: number
  killGraceMs?: number
  managedMigrations?: boolean
  /** Quando definido, um hash das migrações (prisma/migrations) é gravado após o `migrate deploy` com sucesso; se o hash persistido bater, o deploy é pulado na próxima abertura (boot mais rápido). */
  migrationsMarkerPath?: string
  nodeBin?: string
  embedded?: boolean
  postgres?: PostgresManager
}

export interface BackendManager {
  start(): Promise<void>
  stop(): Promise<void>
  restart(): Promise<void>
  getStatus(): BackendState['status']
  getState(): BackendState
  getLogs(): BackendLogs
  onStateChange(listener: (state: BackendState) => void): () => void
}

export function createBackendManager(deps: BackendManagerDeps): BackendManager {
  const {
    spawn: spawnFn,
    execFile: execFileFn,
    fetch: fetchFn,
    settings,
    resourcesBackendPath,
    storagePath,
    runtimePath,
    backendPort = async () => settings.get().backendPort,
    pollIntervalMs = 500,
    healthTimeoutMs = 180_000,
    killGraceMs = 5_000,
    managedMigrations = true,
    migrationsMarkerPath,
    nodeBin = 'node',
    embedded = false,
    postgres,
  } = deps

  let state: BackendState = { status: 'idle' }
  let child: ChildProcess | null = null
  let stopping = false
  let stdoutChunks: string[] = []
  let stderrChunks: string[] = []
  let pollTimer: NodeJS.Timeout | null = null
  let healthTimer: NodeJS.Timeout | null = null
  const listeners = new Set<(next: BackendState) => void>()

  function setState(next: BackendState): void {
    state = next
    for (const listener of listeners) {
      listener(next)
    }
  }

  function clearTimers(): void {
    if (pollTimer !== null) {
      clearTimeout(pollTimer)
      pollTimer = null
    }
    if (healthTimer !== null) {
      clearTimeout(healthTimer)
      healthTimer = null
    }
  }

  function resolveStoragePath(): string {
    if (storagePath !== undefined) {
      return path.resolve(storagePath)
    }
    return path.resolve(path.join(resourcesBackendPath, '..', 'storage'))
  }

  function runPreflight(): Promise<boolean> {
    return new Promise((resolve) => {
      execFileFn('docker', ['version'], (err) => {
        if (err) {
          setState({
            status: 'prereq_failed',
            message: 'Docker não encontrado ou não está em execução. Instale o Docker Desktop e rode `pnpm docker:up`.',
          })
          resolve(false)
          return
        }
        resolve(true)
      })
    })
  }

  function resolveNodeEnv(base: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
    if (nodeBin !== 'node') {
      return { ...base, ELECTRON_RUN_AS_NODE: '1' }
    }
    return base
  }

  function runMigrations(databaseUrl: string): Promise<boolean> {
    return new Promise((resolve) => {
      const prismaCli = path.join(resourcesBackendPath, 'node_modules', 'prisma', 'build', 'index.js')
      const migrationChild = spawnFn(nodeBin, [prismaCli, 'migrate', 'deploy'], {
        cwd: resourcesBackendPath,
        env: resolveNodeEnv({ ...process.env, DATABASE_URL: databaseUrl }),
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      let migrationStderr = ''
      migrationChild.stderr?.on('data', (chunk) => {
        const text = String(chunk)
        migrationStderr += text
        stderrChunks.push(text)
      })
      migrationChild.on('exit', (code) => {
        if (code !== 0) {
          setState({
            status: 'migration_failed',
            message: 'Falha ao executar as migrações do banco de dados.',
            stderr: migrationStderr,
          })
          resolve(false)
          return
        }
        resolve(true)
      })
    })
  }

  function hashMigrationsDir(): string | null {
    const migrationsDir = path.join(resourcesBackendPath, 'prisma', 'migrations')
    let entries: string[]
    try {
      entries = readdirSync(migrationsDir)
    } catch {
      return null
    }
    const files: string[] = []
    for (const entry of entries) {
      const full = path.join(migrationsDir, entry)
      try {
        const st = statSync(full)
        if (st.isFile()) {
          files.push(entry)
        } else if (st.isDirectory()) {
          const nested = readdirSync(full)
          for (const n of nested) {
            files.push(path.join(entry, n))
          }
        }
      } catch {
        // ignora arquivos inacessíveis
      }
    }
    if (files.length === 0) return null
    const hash = createHash('sha256')
    for (const file of files.sort()) {
      hash.update(file)
    }
    return hash.digest('hex')
  }

  function migrationsAreCurrent(): boolean {
    if (migrationsMarkerPath === undefined) return false
    const current = hashMigrationsDir()
    if (current === null) return false
    try {
      return readFileSync(migrationsMarkerPath, 'utf8').trim() === current
    } catch {
      return false
    }
  }

  function persistMigrationsMarker(): void {
    if (migrationsMarkerPath === undefined) return
    const current = hashMigrationsDir()
    if (current === null) return
    try {
      mkdirSync(path.dirname(migrationsMarkerPath), { recursive: true })
      writeFileSync(migrationsMarkerPath, current)
    } catch {
      // best effort — pular deploy na próxima vez é só uma otimização
    }
  }

  function handleExit(code: number | null, _signal: string | null): void {
    if (stopping) return
    if (state.status !== 'starting') return
    clearTimers()
    child = null
    setState({
      status: 'backend_failed',
      message: `O backend encerrou inesperadamente (exit ${code ?? 'desconhecido'}).`,
      stderr: stderrChunks.join(''),
    })
  }

  function spawnBackend(port: number, databaseUrl: string): void {
    const current = settings.get()
    const storage = resolveStoragePath()
    const envBase: NodeJS.ProcessEnv = {
      ...process.env,
      PORT: String(port),
      JWT_SECRET: current.jwtSecret,
      DATABASE_URL: databaseUrl,
      STORAGE_PATH: storage,
      CONVERSIONS_STORAGE_PATH: path.join(storage, 'conversions'),
      OTEL_SDK_DISABLED: 'true',
      MI_DESKTOP_MANAGED: embedded || managedMigrations ? '1' : '0',
    }
    if (embedded) {
      delete envBase.REDIS_URL
      envBase.MI_EMBEDDED_MODE = '1'
      if (runtimePath !== undefined) {
        envBase.MI_EMBEDDED_RUNTIME_PATH = runtimePath
      }
    } else {
      envBase.REDIS_URL = current.redisUrl
    }
    const env = resolveNodeEnv(envBase)
    const appPath = path.join(resourcesBackendPath, 'dist', 'app.js')
    const proc = spawnFn(nodeBin, [appPath], {
      cwd: resourcesBackendPath,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    child = proc
    stdoutChunks = []
    stderrChunks = []
    proc.stdout?.on('data', (chunk) => {
      stdoutChunks.push(String(chunk))
    })
    proc.stderr?.on('data', (chunk) => {
      stderrChunks.push(String(chunk))
    })
    proc.on('exit', handleExit)
  }

  function startHealthPoll(port: number): void {
    clearTimers()
    const healthUrl = `http://127.0.0.1:${port}/api/health`

    healthTimer = setTimeout(() => {
      if (state.status !== 'starting') return
      clearTimers()
      child?.kill('SIGKILL')
      child = null
      setState({
        status: 'backend_failed',
        message: 'O backend não respondeu dentro do tempo limite.',
        stderr: stderrChunks.join(''),
      })
    }, healthTimeoutMs)

    const poll = async (): Promise<void> => {
      if (state.status !== 'starting') return
      try {
        const response = await fetchFn(healthUrl)
        if (response.ok) {
          const body = (await response.json()) as { status?: string }
          if (body.status === 'ok') {
            clearTimers()
            setState({ status: 'ready', message: 'Backend pronto.' })
            return
          }
        }
      } catch {
        // ainda não está pronto; tenta novamente no próximo intervalo
      }
      pollTimer = setTimeout(() => {
        void poll()
      }, pollIntervalMs)
    }
    void poll()
  }

  async function start(): Promise<void> {
    if (child !== null) return
    stopping = false
    setState({ status: 'starting', message: 'Iniciando backend...' })

    if (embedded) {
      if (postgres === undefined) {
        throw new Error('BackendManager: postgres é obrigatório quando embedded=true.')
      }
      try {
        await postgres.start()
      } catch (err) {
        if (err instanceof PostgresManagerError) {
          setState({ status: 'postgres_failed', message: err.message, stderr: err.stderr })
        } else {
          setState({
            status: 'postgres_failed',
            message: 'Falha ao iniciar o PostgreSQL embarcado.',
            stderr: err instanceof Error ? err.message : String(err),
          })
        }
        return
      }
    } else {
      const dockerOk = await runPreflight()
      if (!dockerOk) return
    }

    const databaseUrl = embedded ? postgres!.getDatabaseUrl() : settings.get().databaseUrl

    if (managedMigrations) {
      if (migrationsAreCurrent()) {
        setState({ status: 'starting', message: 'Migrações já aplicadas. Iniciando backend...' })
      } else {
        const migrationsOk = await runMigrations(databaseUrl)
        if (!migrationsOk) return
        persistMigrationsMarker()
      }
    }

    const port = await backendPort()
    spawnBackend(port, databaseUrl)
    startHealthPoll(port)
  }

  async function stop(): Promise<void> {
    const current = child
    if (current !== null) {
      stopping = true
      child = null
      clearTimers()

      await new Promise<void>((resolve) => {
        let settled = false
        const finish = (): void => {
          if (settled) return
          settled = true
          resolve()
        }
        current.once('exit', finish)
        const killed = current.kill('SIGTERM')
        if (killed === false) {
          finish()
          return
        }
        const graceTimer = setTimeout(() => {
          current.kill('SIGKILL')
          finish()
        }, killGraceMs)
        current.once('exit', () => clearTimeout(graceTimer))
      })

      setState({ status: 'idle' })
      stopping = false
    }

    if (embedded && postgres !== undefined) {
      try {
        await postgres.stop()
      } catch (err) {
        console.error('Falha ao parar o PostgreSQL embarcado.', err)
      }
    }
  }

  async function restart(): Promise<void> {
    await stop()
    await start()
  }

  function getStatus(): BackendState['status'] {
    return state.status
  }

  function getState(): BackendState {
    return { ...state }
  }

  function getLogs(): BackendLogs {
    return { stdout: stdoutChunks.join(''), stderr: stderrChunks.join('') }
  }

  function onStateChange(listener: (next: BackendState) => void): () => void {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }

  return { start, stop, restart, getStatus, getState, getLogs, onStateChange }
}
