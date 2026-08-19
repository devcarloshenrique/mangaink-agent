import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('dotenv/config', () => ({}))

type Env = typeof import('../env').env

const REQUIRED_ENV: Record<string, string> = {
  JWT_SECRET: 'test-jwt-secret-min-32-chars-long-security',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/mangaink_test',
  X_API_TOKEN: 'test-x-api-token',
}

let importSeq = 0

async function loadEnv(overrides: Record<string, string | undefined> = {}): Promise<Env> {
  vi.resetModules()
  for (const [key, value] of Object.entries(REQUIRED_ENV)) {
    vi.stubEnv(key, value)
  }
  for (const [key, value] of Object.entries(overrides)) {
    vi.stubEnv(key, value)
  }
  importSeq += 1
  const { env } = (await import(`../env?t=${importSeq}`)) as { env: Env }
  return env
}

async function loadEnvWithout(required: 'JWT_SECRET' | 'DATABASE_URL' | 'X_API_TOKEN'): Promise<Env> {
  vi.resetModules()
  for (const [key, value] of Object.entries(REQUIRED_ENV)) {
    vi.stubEnv(key, value)
  }
  vi.stubEnv(required, undefined)
  importSeq += 1
  const { env } = (await import(`../env?t=${importSeq}`)) as { env: Env }
  return env
}

describe('env — modo embedded (MI_EMBEDDED_*)', () => {
  beforeEach(() => {
    vi.stubEnv('MI_EMBEDDED_MODE', undefined)
    vi.stubEnv('MI_EMBEDDED_RUNTIME_PATH', undefined)
    vi.stubEnv('REDIS_URL', undefined)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('MI_EMBEDDED_MODE=1 → true', async () => {
    const env = await loadEnv({ MI_EMBEDDED_MODE: '1' })
    expect(env.MI_EMBEDDED_MODE).toBe(true)
  })

  it('MI_EMBEDDED_MODE=true → true', async () => {
    const env = await loadEnv({ MI_EMBEDDED_MODE: 'true' })
    expect(env.MI_EMBEDDED_MODE).toBe(true)
  })

  it('MI_EMBEDDED_MODE ausente → false', async () => {
    const env = await loadEnv({})
    expect(env.MI_EMBEDDED_MODE).toBe(false)
  })

  it('MI_EMBEDDED_MODE=false → false (não usa z.coerce.boolean)', async () => {
    const env = await loadEnv({ MI_EMBEDDED_MODE: 'false' })
    expect(env.MI_EMBEDDED_MODE).toBe(false)
  })

  it('MI_EMBEDDED_RUNTIME_PATH definida → string preservada', async () => {
    const env = await loadEnv({ MI_EMBEDDED_RUNTIME_PATH: 'C:\\foo\\bar' })
    expect(env.MI_EMBEDDED_RUNTIME_PATH).toBe('C:\\foo\\bar')
  })

  it('MI_EMBEDDED_RUNTIME_PATH ausente → undefined', async () => {
    const env = await loadEnv({})
    expect(env.MI_EMBEDDED_RUNTIME_PATH).toBeUndefined()
  })

  it('REDIS_URL ausente → default preservado (web)', async () => {
    const env = await loadEnv({})
    expect(env.REDIS_URL).toBe('redis://localhost:6379')
  })

  it('REDIS_URL ausente + MI_EMBEDDED_MODE=1 → default preservado (embedded)', async () => {
    const env = await loadEnv({ MI_EMBEDDED_MODE: '1' })
    expect(env.REDIS_URL).toBe('redis://localhost:6379')
  })

  it('REDIS_URL presente → valor preservado', async () => {
    const env = await loadEnv({ REDIS_URL: 'redis://cache:6379' })
    expect(env.REDIS_URL).toBe('redis://cache:6379')
  })

  it('defaults existentes inalterados', async () => {
    const env = await loadEnv({
      PORT: undefined,
      STORAGE_PATH: undefined,
      CONVERSIONS_STORAGE_PATH: undefined,
      KCC_DOCKER_IMAGE: undefined,
      MOBI_PREVIEW_TTL_SEC: undefined,
      STORAGE_SWEEPER_INTERVAL_MS: undefined,
      STORAGE_SWEEPER_MIN_ORPHAN_AGE_MS: undefined,
    })
    expect(env.PORT).toBe(3333)
    expect(env.STORAGE_PATH).toBe('./storage')
    expect(env.CONVERSIONS_STORAGE_PATH).toBe('./storage/conversions')
    expect(env.KCC_DOCKER_IMAGE).toBe('mangaink-kcc:10.3.0')
    expect(env.MOBI_PREVIEW_TTL_SEC).toBe(86400)
    expect(env.STORAGE_SWEEPER_INTERVAL_MS).toBe(6 * 60 * 60 * 1000)
    expect(env.STORAGE_SWEEPER_MIN_ORPHAN_AGE_MS).toBe(24 * 60 * 60 * 1000)
  })

  it("NODE_ENV='development' (Vite dev) → normalizado para 'dev'", async () => {
    const env = await loadEnv({ NODE_ENV: 'development' })
    expect(env.NODE_ENV).toBe('dev')
  })

  it('NODE_ENV ausente → default dev', async () => {
    const env = await loadEnv({ NODE_ENV: undefined })
    expect(env.NODE_ENV).toBe('dev')
  })

  it('JWT_SECRET ausente → erro de parse', async () => {
    await expect(loadEnvWithout('JWT_SECRET')).rejects.toThrow('Variáveis de ambiente inválidas')
  })

  it('DATABASE_URL ausente → erro de parse', async () => {
    await expect(loadEnvWithout('DATABASE_URL')).rejects.toThrow('Variáveis de ambiente inválidas')
  })

  it('X_API_TOKEN ausente → erro de parse', async () => {
    await expect(loadEnvWithout('X_API_TOKEN')).rejects.toThrow('Variáveis de ambiente inválidas')
  })
})
