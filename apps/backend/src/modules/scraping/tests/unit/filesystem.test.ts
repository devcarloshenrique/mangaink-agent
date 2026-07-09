import { describe, expect, it } from 'vitest'
import { mkdirp, writeJson, readJson, pathExists } from '../../../../shared/utils/filesystem'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'

describe('Filesystem Utils', () => {
  const testDir = path.join(os.tmpdir(), `mangaink-test-${Date.now()}`)
  const testFile = path.join(testDir, 'nested', 'dir', 'test.json')

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true })
  })

  it('mkdirp deve criar diretórios aninhados', async () => {
    await mkdirp(path.join(testDir, 'nested', 'dir'))
    const exists = await pathExists(path.join(testDir, 'nested', 'dir'))
    expect(exists).toBe(true)
  })

  it('writeJson deve criar arquivo com conteúdo JSON', async () => {
    const data = { name: 'test', value: 123 }
    await writeJson(testFile, data)
    const content = await fs.readFile(testFile, 'utf-8')
    const parsed = JSON.parse(content)
    expect(parsed).toEqual(data)
  })

  it('writeJson deve criar diretórios pai automaticamente', async () => {
    await writeJson(testFile, { hello: 'world' })
    const exists = await pathExists(testFile)
    expect(exists).toBe(true)
  })

  it('readJson deve ler arquivo JSON existente', async () => {
    await writeJson(testFile, { key: 'value' })
    const result = await readJson<{ key: string }>(testFile)
    expect(result).toEqual({ key: 'value' })
  })

  it('readJson deve retornar null para arquivo inexistente', async () => {
    const result = await readJson('/tmp/nonexistent-file.json')
    expect(result).toBeNull()
  })

  it('readJson deve retornar null para JSON malformado', async () => {
    const badFile = path.join(testDir, 'bad.json')
    await fs.mkdir(path.dirname(badFile), { recursive: true })
    await fs.writeFile(badFile, 'not json', 'utf-8')
    const result = await readJson(badFile)
    expect(result).toBeNull()
  })

  it('pathExists deve retornar true para arquivo existente', async () => {
    await writeJson(testFile, {})
    const result = await pathExists(testFile)
    expect(result).toBe(true)
  })

  it('pathExists deve retornar false para caminho inexistente', async () => {
    const result = await pathExists('/tmp/definitely-not-exists-12345')
    expect(result).toBe(false)
  })

  it('pathExists deve retornar true para diretório existente', async () => {
    const result = await pathExists(testDir)
    expect(result).toBe(true)
  })
})