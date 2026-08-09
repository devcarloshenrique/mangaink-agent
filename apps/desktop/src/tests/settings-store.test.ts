import { randomUUID } from 'node:crypto'
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { createSettingsStore } from '../main/settings-store'

const DEFAULT_BACKEND_PORT = 3333
const DEFAULT_DATABASE_URL = 'postgresql://mangaink:mangaink@localhost:5432/mangaink_agent_db'
const DEFAULT_REDIS_URL = 'redis://localhost:6379'
const JWT_SECRET_HEX = /^[0-9a-f]{64}$/

const tempRoot = join(tmpdir(), `mangaink-settings-${randomUUID()}`)

describe('settings-store', () => {
  afterAll(async () => {
    await rm(tempRoot, { recursive: true, force: true })
  })

  it('cria o arquivo com defaults quando o arquivo não existe', async () => {
    const dir = join(tempRoot, 'missing')
    await mkdir(dir, { recursive: true })
    const filePath = join(dir, 'settings.json')

    const store = createSettingsStore({ filePath })
    const settings = await store.load()

    expect(settings.backendPort).toBe(DEFAULT_BACKEND_PORT)
    expect(settings.databaseUrl).toBe(DEFAULT_DATABASE_URL)
    expect(settings.redisUrl).toBe(DEFAULT_REDIS_URL)
    expect(settings.jwtSecret).toMatch(JWT_SECRET_HEX)

    const onDisk = JSON.parse(await readFile(filePath, 'utf-8'))
    expect(onDisk).toMatchObject({
      backendPort: DEFAULT_BACKEND_PORT,
      databaseUrl: DEFAULT_DATABASE_URL,
      redisUrl: DEFAULT_REDIS_URL,
    })
    expect(onDisk.jwtSecret).toBe(settings.jwtSecret)
  })

  it('persiste o jwtSecret e o reutiliza em novas instâncias', async () => {
    const dir = join(tempRoot, 'persist')
    await mkdir(dir, { recursive: true })
    const filePath = join(dir, 'settings.json')

    const first = await createSettingsStore({ filePath }).load()

    expect(first.jwtSecret).toMatch(JWT_SECRET_HEX)

    const again = await createSettingsStore({ filePath }).load()

    expect(again.jwtSecret).toBe(first.jwtSecret)
  })

  it('save() escreve atomicamente sem deixar arquivo temporário residual', async () => {
    const dir = join(tempRoot, 'atomic')
    await mkdir(dir, { recursive: true })
    const filePath = join(dir, 'settings.json')

    const store = createSettingsStore({ filePath })
    await store.load()

    await store.save({ ...store.get(), backendPort: 4444 })

    const files = await readdir(dir)
    expect(files).toEqual(['settings.json'])

    const onDisk = JSON.parse(await readFile(filePath, 'utf-8'))
    expect(onDisk.backendPort).toBe(4444)
    expect(onDisk.jwtSecret).toBe(store.get().jwtSecret)
  })

  it('arquivo corrompido cai em defaults sem lançar e é reescrito válido', async () => {
    const dir = join(tempRoot, 'corrupt')
    await mkdir(dir, { recursive: true })
    const filePath = join(dir, 'settings.json')
    await writeFile(filePath, '{nao-json', 'utf-8')

    const store = createSettingsStore({ filePath })
    const settings = await store.load()

    expect(settings.backendPort).toBe(DEFAULT_BACKEND_PORT)
    expect(settings.databaseUrl).toBe(DEFAULT_DATABASE_URL)
    expect(settings.redisUrl).toBe(DEFAULT_REDIS_URL)

    const onDisk = JSON.parse(await readFile(filePath, 'utf-8'))
    expect(onDisk).toMatchObject({
      backendPort: DEFAULT_BACKEND_PORT,
      databaseUrl: DEFAULT_DATABASE_URL,
      redisUrl: DEFAULT_REDIS_URL,
    })
    expect(onDisk.jwtSecret).toMatch(JWT_SECRET_HEX)
  })

  it('persiste e restaura managedPostgresPort via save/load', async () => {
    const dir = join(tempRoot, 'managed-save-load')
    await mkdir(dir, { recursive: true })
    const filePath = join(dir, 'settings.json')

    const store = createSettingsStore({ filePath })
    await store.load()

    await store.save({ ...store.get(), managedPostgresPort: 55432 })

    const onDisk = JSON.parse(await readFile(filePath, 'utf-8'))
    expect(onDisk.managedPostgresPort).toBe(55432)

    const reloaded = await createSettingsStore({ filePath }).load()
    expect(reloaded.managedPostgresPort).toBe(55432)
  })

  it('arquivo legado sem managedPostgresPort carrega sem erro (jwtSecret gerado se ausente)', async () => {
    const dir = join(tempRoot, 'legacy')
    await mkdir(dir, { recursive: true })
    const filePath = join(dir, 'settings.json')

    await writeFile(
      filePath,
      JSON.stringify({
        backendPort: 4000,
        databaseUrl: DEFAULT_DATABASE_URL,
        redisUrl: DEFAULT_REDIS_URL,
      }),
      'utf-8',
    )

    const settings = await createSettingsStore({ filePath }).load()

    expect(settings.managedPostgresPort).toBeUndefined()
    expect(settings.backendPort).toBe(4000)
    expect(settings.databaseUrl).toBe(DEFAULT_DATABASE_URL)
    expect(settings.redisUrl).toBe(DEFAULT_REDIS_URL)
    expect(settings.jwtSecret).toMatch(JWT_SECRET_HEX)
  })

  it('getManagedPostgresPort() devolve o valor salvo ou undefined', async () => {
    const dir = join(tempRoot, 'get-managed')
    await mkdir(dir, { recursive: true })
    const filePath = join(dir, 'settings.json')

    const store = createSettingsStore({ filePath })
    await store.load()

    expect(store.getManagedPostgresPort()).toBeUndefined()

    await store.setManagedPostgresPort(55432)

    expect(store.getManagedPostgresPort()).toBe(55432)
  })

  it('setManagedPostgresPort(port) persiste em round-trip sem reescrever jwtSecret', async () => {
    const dir = join(tempRoot, 'set-managed')
    await mkdir(dir, { recursive: true })
    const filePath = join(dir, 'settings.json')

    const store = createSettingsStore({ filePath })
    const before = await store.load()
    const jwtSecret = before.jwtSecret

    await store.setManagedPostgresPort(54321)

    const onDisk = JSON.parse(await readFile(filePath, 'utf-8'))
    expect(onDisk.managedPostgresPort).toBe(54321)
    expect(onDisk.jwtSecret).toBe(jwtSecret)
    expect(onDisk.backendPort).toBe(DEFAULT_BACKEND_PORT)

    const reloaded = await createSettingsStore({ filePath }).load()
    expect(reloaded.managedPostgresPort).toBe(54321)
    expect(reloaded.jwtSecret).toBe(jwtSecret)
  })
})
