import { mkdirSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { execSync } from 'node:child_process'
import dotenv from 'dotenv'
import pg from 'pg'

const tempRoot = join(tmpdir(), `mangaink-test-${randomUUID()}`)

async function truncateTestDatabase(dbUrl: string) {
  try {
    const client = new pg.Client({ connectionString: dbUrl })
    await client.connect()
    const tablesRes = await client.query<{ tablename: string }>(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT LIKE '_prisma%';"
    )
    if (tablesRes.rows.length > 0) {
      const tableNames = tablesRes.rows.map((r) => `"${r.tablename}"`).join(', ')
      await client.query(`TRUNCATE TABLE ${tableNames} CASCADE;`)
    }
    await client.end()
  } catch {
    // Se o postgres não estiver disponível no momento, segue
  }
}

export async function setup() {
  const storagePath = join(tempRoot, 'storage')
  const conversionsPath = join(storagePath, 'conversions')

  mkdirSync(conversionsPath, { recursive: true })

  process.env.STORAGE_PATH = storagePath
  process.env.CONVERSIONS_STORAGE_PATH = conversionsPath
  process.env.NODE_ENV = 'test'

  // Carrega .env.test
  const envTestPath = existsSync('.env.test')
    ? resolve('.env.test')
    : resolve(__dirname, '.env.test')

  if (existsSync(envTestPath)) {
    dotenv.config({ path: envTestPath, override: true })
  }

  const testDbUrl =
    process.env.DATABASE_URL ||
    'postgresql://mangaink:mangaink@localhost:5432/mangaink_agent_test_db'
  process.env.DATABASE_URL = testDbUrl

  // Garante que o banco de teste existe no PostgreSQL se estiver rodando
  let pgAvailable = false
  try {
    const adminUrl = testDbUrl.replace(/\/([^/?]+)(\?.*)?$/, '/postgres$2')
    const client = new pg.Client({ connectionString: adminUrl })
    await client.connect()
    const res = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = 'mangaink_agent_test_db'",
    )
    if (res.rowCount === 0) {
      await client.query('CREATE DATABASE mangaink_agent_test_db')
    }
    await client.end()
    pgAvailable = true
  } catch {
    // Se o postgres não estiver disponível no momento do setup, segue
  }

  if (pgAvailable) {
    try {
      execSync(`npx prisma db push --accept-data-loss --url "${testDbUrl}"`, {
        cwd: __dirname,
        env: { ...process.env, DATABASE_URL: testDbUrl },
        stdio: 'pipe',
      })
    } catch (e) {
      console.warn('[vitest globalSetup] prisma db push failed:', (e as Error).message)
    }
  }

  // Limpa todas as tabelas antes de iniciar a suíte de testes (garantia de estado limpo)
  await truncateTestDatabase(testDbUrl)
}

export async function teardown() {
  rmSync(tempRoot, { recursive: true, force: true })

  const testDbUrl =
    process.env.DATABASE_URL ||
    'postgresql://mangaink:mangaink@localhost:5432/mangaink_agent_test_db'

  // Limpa todas as tabelas ao término da execução dos testes
  await truncateTestDatabase(testDbUrl)
}

