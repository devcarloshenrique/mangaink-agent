import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createPostgresManager, type PostgresManager } from '../main/postgres-manager'

const RESOURCES_BIN = join(process.cwd(), 'resources', 'runtime', 'postgres', 'bin')

const BINARIES_PRESENT = ['initdb.exe', 'pg_ctl.exe', 'createdb.exe', 'psql.exe'].every((f) =>
  existsSync(join(RESOURCES_BIN, f)),
)

const skipReason =
  process.env.MI_SKIP_PG_INTEGRATION === '1'
    ? 'MI_SKIP_PG_INTEGRATION definido'
    : !BINARIES_PRESENT
      ? 'binários do runtime Postgres ausentes'
      : null

function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address !== null ? address.port : 0
      server.close(() => resolve(port))
    })
  })
}

describe.skipIf(skipReason !== null)('postgres-manager (integração real)', () => {
  let dataDir: string
  let manager: PostgresManager

  beforeAll(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'mangaink-pg-it-'))
    const port = await findFreePort()
    manager = createPostgresManager({
      execFile,
      runtimePostgresBin: RESOURCES_BIN,
      dataDir,
      port,
      pollIntervalMs: 500,
      startTimeoutMs: 60_000,
    })
    await manager.start()
  }, 120_000)

  afterAll(async () => {
    await manager?.stop()
    await rm(dataDir, { recursive: true, force: true })
  }, 60_000)

  it('sobe um cluster real, cria o banco e responde a getDatabaseUrl', () => {
    expect(manager.isRunning()).toBe(true)
    expect(manager.getPort()).toBeGreaterThan(0)
    expect(manager.getDatabaseUrl()).toMatch(/^postgresql:\/\/postgres@127\.0\.0\.1:\d+\/mangaink_agent_db$/)
  }, 30_000)

  it('stop() encerra o cluster real (segundo stop é no-op)', async () => {
    await manager.stop()
    expect(manager.isRunning()).toBe(false)
    await expect(manager.stop()).resolves.toBeUndefined()
  }, 30_000)
})
