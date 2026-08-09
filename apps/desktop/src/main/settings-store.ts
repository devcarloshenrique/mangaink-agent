import { randomBytes, randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

export interface DesktopSettings {
  backendPort: number
  databaseUrl: string
  redisUrl: string
  jwtSecret: string
  /** Preferência de porta do Postgres gerenciado no modo embedded. Opcional — undefined quando não configurada. */
  managedPostgresPort?: number
}

export interface SettingsStoreOptions {
  filePath: string
  defaults?: Partial<DesktopSettings>
}

export interface SettingsStore {
  load(): Promise<DesktopSettings>
  get(): DesktopSettings
  save(settings: DesktopSettings): Promise<void>
  getManagedPostgresPort(): number | undefined
  setManagedPostgresPort(port: number): Promise<void>
}

const DEFAULT_SETTINGS: DesktopSettings = {
  backendPort: 3333,
  databaseUrl: 'postgresql://mangaink:mangaink@localhost:5432/mangaink_agent_db',
  redisUrl: 'redis://localhost:6379',
  jwtSecret: '',
}

function generateJwtSecret(): string {
  return randomBytes(32).toString('hex')
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath)
    return true
  } catch {
    return false
  }
}

async function writeJsonAtomic(filePath: string, data: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  const tmpPath = `${filePath}.${randomUUID()}.tmp`
  try {
    await fs.writeFile(tmpPath, JSON.stringify(data, null, 2), 'utf-8')
    await fs.rename(tmpPath, filePath)
  } catch (err) {
    await fs.rm(tmpPath, { force: true }).catch(() => undefined)
    throw err
  }
}

/**
 * Store de settings persistidas em `userData/settings.json`.
 *
 * Em modo embedded, `databaseUrl` e `redisUrl` do arquivo são IGNORADAS — portas e
 * URLs são gerenciadas pelo app (ver spec `desktop-runtime-orchestration`). Esses
 * campos são mantidos apenas para compatibilidade web/dev. `backendPort` e
 * `jwtSecret` continuam persistidos e reutilizados entre execuções.
 *
 * `managedPostgresPort` é apenas PERSISTIDO como preferência; a revalidação de
 * porta livre a cada boot é responsabilidade do PostgresManager (não deste store).
 *
 * Credenciais (ex.: `jwtSecret`) nunca são expostas publicamente — ficam no arquivo
 * local e são retornadas apenas via `load()`/`get()`, consumidas pelo processo main.
 */
export function createSettingsStore(options: SettingsStoreOptions): SettingsStore {
  const { filePath, defaults = {} } = options
  const base: DesktopSettings = { ...DEFAULT_SETTINGS, ...defaults }
  let current: DesktopSettings = { ...base }

  async function load(): Promise<DesktopSettings> {
    let parsed: Partial<DesktopSettings> | null = null
    let readFailed = false
    try {
      const raw = await fs.readFile(filePath, 'utf-8')
      parsed = JSON.parse(raw) as Partial<DesktopSettings>
    } catch {
      readFailed = true
    }

    const settings: DesktopSettings = {
      ...base,
      ...(parsed ?? {}),
    }

    const missingJwtSecret = !settings.jwtSecret
    if (missingJwtSecret) {
      settings.jwtSecret = generateJwtSecret()
    }

    if (readFailed || !parsed || missingJwtSecret) {
      await writeJsonAtomic(filePath, settings)
    }

    current = { ...settings }
    return { ...settings }
  }

  function get(): DesktopSettings {
    return { ...current }
  }

  async function save(settings: DesktopSettings): Promise<void> {
    await writeJsonAtomic(filePath, settings)
    current = { ...settings }
  }

  function getManagedPostgresPort(): number | undefined {
    return current.managedPostgresPort
  }

  async function setManagedPostgresPort(port: number): Promise<void> {
    const updated: DesktopSettings = { ...current }
    if (!updated.jwtSecret) {
      updated.jwtSecret = generateJwtSecret()
    }
    updated.managedPostgresPort = port
    await writeJsonAtomic(filePath, updated)
    current = { ...updated }
  }

  return { load, get, save, getManagedPostgresPort, setManagedPostgresPort }
}
