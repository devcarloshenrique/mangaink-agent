import { execFile, spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createServer } from 'node:net'
import path from 'node:path'

export interface PostgresManagerDeps {
  execFile: typeof execFile
  spawn?: typeof spawn
  runtimePostgresBin: string
  dataDir: string
  port?: number
  host?: string
  databaseName?: string
  pollIntervalMs?: number
  startTimeoutMs?: number
  findFreePort?: () => Promise<number>
}

export interface PostgresManager {
  start(): Promise<void>
  stop(): Promise<void>
  getPort(): number
  getDatabaseUrl(): string
  isRunning(): boolean
}

export class PostgresManagerError extends Error {
  constructor(message: string, public readonly stderr?: string) {
    super(message)
    this.name = 'PostgresManagerError'
  }
}

function findFreePortViaNet(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address !== null ? address.port : 0
      server.close(() => {
        if (port === 0) reject(new PostgresManagerError('Não foi possível obter uma porta livre.'))
        else resolve(port)
      })
    })
  })
}

export function createPostgresManager(deps: PostgresManagerDeps): PostgresManager {
  const {
    execFile: execFileFn,
    spawn: spawnFn = spawn,
    runtimePostgresBin,
    dataDir,
    port: fixedPort,
    host = '127.0.0.1',
    databaseName = 'mangaink_agent_db',
    pollIntervalMs = 300,
    startTimeoutMs = 30_000,
    findFreePort = findFreePortViaNet,
  } = deps

  let running = false
  let port: number | null = fixedPort ?? null

  function bin(name: string): string {
    return path.join(runtimePostgresBin, `${name}.exe`)
  }

  function run(cmd: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      execFileFn(cmd, args, (err, stdout, stderr) => {
        if (err) {
          reject(new PostgresManagerError(`${path.basename(cmd)} falhou: ${err.message}`, String(stderr)))
          return
        }
        resolve({ stdout: String(stdout), stderr: String(stderr) })
      })
    })
  }

  function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  function startServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      let stderr = ''
      let settled = false
      const child = spawnFn(
        bin('pg_ctl'),
        [
          '-D',
          dataDir,
          '-l',
          path.join(dataDir, 'postgres.log'),
          '-o',
          `-p ${port} -h ${host}`,
          '-w',
          'start',
        ],
        { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true },
      )
      child.stderr?.on('data', (chunk) => {
        stderr += String(chunk)
      })
      child.on('error', (err) => {
        if (settled) return
        settled = true
        reject(new PostgresManagerError(`pg_ctl start falhou: ${err.message}`, stderr))
      })
      child.on('exit', (code) => {
        if (settled) return
        settled = true
        if (code !== 0) {
          reject(new PostgresManagerError(`pg_ctl start falhou (exit ${code ?? 'desconhecido'}).`, stderr))
          return
        }
        resolve()
      })
    })
  }

  async function waitForReadiness(): Promise<void> {
    const deadline = Date.now() + startTimeoutMs
    let lastStderr: string | undefined
    while (Date.now() < deadline) {
      try {
        const result = await run(bin('psql'), [
          '-h',
          host,
          '-p',
          String(port),
          '-U',
          'postgres',
          '-tAc',
          'SELECT 1',
        ])
        if (result.stdout.trim() === '1') return
        lastStderr = result.stdout
      } catch (err) {
        if (err instanceof PostgresManagerError) {
          lastStderr = err.stderr
        }
      }
      await sleep(pollIntervalMs)
    }
    throw new PostgresManagerError(`PostgreSQL não respondeu em ${startTimeoutMs}ms.`, lastStderr)
  }

  async function ensureDatabase(): Promise<void> {
    const check = await run(bin('psql'), [
      '-h',
      host,
      '-p',
      String(port),
      '-U',
      'postgres',
      '-tAc',
      `SELECT 1 FROM pg_database WHERE datname='${databaseName}'`,
    ])
    if (check.stdout.trim() === '1') return
    await run(bin('createdb'), ['-h', host, '-p', String(port), '-U', 'postgres', databaseName])
  }

  async function start(): Promise<void> {
    if (running) return

    if (!existsSync(path.join(dataDir, 'PG_VERSION'))) {
      await run(bin('initdb'), ['-D', dataDir, '-U', 'postgres', '--auth=trust', '-E', 'UTF8'])
    }

    if (port === null) {
      port = await findFreePort()
    }

    await startServer()
    await waitForReadiness()
    await ensureDatabase()

    running = true
  }

  async function stop(): Promise<void> {
    if (!running) return
    try {
      await run(bin('pg_ctl'), ['-D', dataDir, '-m', 'fast', '-w', 'stop'])
    } catch (err) {
      const stderr = err instanceof PostgresManagerError ? err.stderr : ''
      if (!(err instanceof PostgresManagerError) || !/(not running|does not run|no server)/i.test(stderr ?? '')) {
        throw err
      }
    }
    running = false
  }

  function getPort(): number {
    if (port === null) {
      throw new PostgresManagerError('Porta ainda não determinada — chame start() primeiro.')
    }
    return port
  }

  function getDatabaseUrl(): string {
    return `postgresql://postgres@${host}:${getPort()}/${databaseName}`
  }

  function isRunning(): boolean {
    return running
  }

  return { start, stop, getPort, getDatabaseUrl, isRunning }
}
