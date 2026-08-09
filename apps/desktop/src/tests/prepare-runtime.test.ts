import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import {
  cleanPythonRuntime,
  isPrepared,
  resolveDest,
  stripComponentsFor,
  verifySha256,
} from '../../scripts/prepare-runtime.mjs'

const tempRoot = join(tmpdir(), `mangaink-prepare-runtime-${Date.now()}`)

const ARTIFACTS = {
  postgres: { id: 'postgres', dest: 'postgres', key: ['bin', 'pg_ctl.exe'] },
  python: { id: 'python', dest: 'python', key: ['python.exe'] },
  kccSource: { id: 'kcc-source', dest: 'kcc', key: ['kindlecomicconverter', 'comic2ebook.py'], wrapper: ['kcc-c2e.py'] },
  kindlegen: { id: 'kindlegen', dest: 'kindlegen', key: ['kindlegen.exe'] },
  wheels: { id: 'wheels', dest: null, key: ['.wheels-ok'] },
}

async function sha256Of(filePath) {
  const { readFile } = await import('node:fs/promises')
  return createHash('sha256').update(await readFile(filePath)).digest('hex')
}

describe('prepare-runtime — lógica pura', () => {
  beforeEach(async () => {
    await rm(tempRoot, { recursive: true, force: true })
    await mkdir(tempRoot, { recursive: true })
  })

  afterAll(async () => {
    await rm(tempRoot, { recursive: true, force: true })
  })

  describe('verifySha256', () => {
    it('passa quando o hash bate com o esperado', async () => {
      const file = join(tempRoot, 'ok.bin')
      await writeFile(file, 'hello runtime')
      const expected = await sha256Of(file)
      expect(await verifySha256(file, expected)).toBe(true)
    })

    it('aborta (retorna false) quando o hash diverge', async () => {
      const file = join(tempRoot, 'bad.bin')
      await writeFile(file, 'conteudo real')
      const wrong = '0'.repeat(64)
      expect(await verifySha256(file, wrong)).toBe(false)
    })
  })

  describe('resolveDest', () => {
    it('mapeia artifact.dest para o dir dentro do runtime', () => {
      expect(resolveDest(tempRoot, { dest: 'postgres' })).toBe(join(tempRoot, 'postgres'))
      expect(resolveDest(tempRoot, { dest: 'python' })).toBe(join(tempRoot, 'python'))
    })

    it('retorna null para artefatos sem dest (wheels)', () => {
      expect(resolveDest(tempRoot, { dest: null })).toBeNull()
    })
  })

  describe('stripComponentsFor (stripRoot)', () => {
    it('stripRoot=true → --strip-components=1 (achata a raiz única)', () => {
      expect(stripComponentsFor(true)).toEqual(['--strip-components=1'])
    })

    it('stripRoot=false/ausente → sem flag de strip', () => {
      expect(stripComponentsFor(false)).toEqual([])
      expect(stripComponentsFor(undefined)).toEqual([])
    })
  })

  describe('isPrepared (idempotência — skip se existe)', () => {
    it('retorna false quando o destino ainda não existe', () => {
      for (const artifact of Object.values(ARTIFACTS)) {
        expect(isPrepared(tempRoot, artifact)).toBe(false)
      }
    })

    it('retorna true quando os arquivos-chave existem', async () => {
      const mkdirp = async (parts) => {
        const dir = join(tempRoot, ...parts.slice(0, -1))
        await mkdir(dir, { recursive: true })
        await writeFile(join(tempRoot, ...parts), 'x')
      }
      await mkdirp(['postgres', 'bin', 'pg_ctl.exe'])
      await mkdirp(['python', 'python.exe'])
      await mkdirp(['kcc', 'kindlecomicconverter', 'comic2ebook.py'])
      await mkdirp(['kcc', 'kcc-c2e.py'])
      await mkdirp(['kindlegen', 'kindlegen.exe'])
      await writeFile(join(tempRoot, '.wheels-ok'), new Date().toISOString())

      for (const artifact of Object.values(ARTIFACTS)) {
        expect(isPrepared(tempRoot, artifact)).toBe(true)
      }
    })

    it('kcc-source sem o wrapper kcc-c2e.py NÃO é considerado pronto', async () => {
      const dir = join(tempRoot, 'kcc', 'kindlecomicconverter')
      await mkdir(dir, { recursive: true })
      await writeFile(join(dir, 'comic2ebook.py'), 'x')
      expect(isPrepared(tempRoot, ARTIFACTS.kccSource)).toBe(false)
    })
  })

  describe('cleanPythonRuntime', () => {
    it('remove .pdb e __pycache__ e reporta bytes economizados', async () => {
      const pythonDir = join(tempRoot, 'py-clean')
      await mkdir(join(pythonDir, 'DLLs'), { recursive: true })
      await mkdir(join(pythonDir, 'Lib', 'site-packages', '__pycache__'), { recursive: true })
      await writeFile(join(pythonDir, 'python.pdb'), 'pdb-bytes')
      await writeFile(join(pythonDir, 'DLLs', '_x.pyd.pdb'), 'pdb2')
      await writeFile(join(pythonDir, 'Lib', 'site-packages', '__pycache__', 'm.cpython-311.pyc'), 'pyc')
      await writeFile(join(pythonDir, 'Lib', 'site-packages', 'keep.py'), 'keep')

      const saved = cleanPythonRuntime(pythonDir)

      expect(saved).toBeGreaterThan(0)
      const { readdir } = await import('node:fs/promises')
      expect(await readdir(pythonDir)).not.toContain('python.pdb')
      expect(await readdir(join(pythonDir, 'Lib', 'site-packages'))).toContain('keep.py')
      // __pycache__ removido recursivamente
      const { existsSync } = await import('node:fs')
      expect(existsSync(join(pythonDir, 'Lib', 'site-packages', '__pycache__'))).toBe(false)
    })
  })
})
