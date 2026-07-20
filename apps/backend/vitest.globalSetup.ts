import { mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

const tempRoot = join(tmpdir(), `mangaink-test-${randomUUID()}`)

export function setup() {
  const storagePath = join(tempRoot, 'storage')
  const conversionsPath = join(storagePath, 'conversions')

  mkdirSync(conversionsPath, { recursive: true })

  process.env.STORAGE_PATH = storagePath
  process.env.CONVERSIONS_STORAGE_PATH = conversionsPath
}

export function teardown() {
  rmSync(tempRoot, { recursive: true, force: true })
}
