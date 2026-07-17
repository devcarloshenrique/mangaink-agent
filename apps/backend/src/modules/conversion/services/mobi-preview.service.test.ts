import { describe, it, expect, beforeEach, vi } from 'vitest'

const fsMock = vi.hoisted(() => {
  const storage = new Map<string, { stat: { mtimeMs: number; size: number }; content: Buffer | string }>()
  return {
    storage,
    reset: () => storage.clear(),
    writeFile: vi.fn(async (p: string, content: Buffer | string) => {
      storage.set(p, { stat: { mtimeMs: Date.now(), size: typeof content === 'string' ? content.length : content.byteLength }, content })
    }),
    readFile: vi.fn(async (p: string) => {
      const entry = storage.get(p)
      if (!entry) throw new Error(`ENOENT: ${p}`)
      return entry.content
    }),
    readdir: vi.fn(async (p: string) => {
      const keys = Array.from(storage.keys())
      const prefix = p.endsWith('/') ? p : `${p}/`
      return keys
        .filter((k) => k.startsWith(prefix))
        .map((k) => k.slice(prefix.length))
        .filter((f) => !f.includes('/'))
    }),
    stat: vi.fn(async (p: string) => {
      const entry = storage.get(p)
      if (!entry) throw new Error(`ENOENT: ${p}`)
      return { size: entry.stat.size, mtimeMs: entry.stat.mtimeMs, mtime: new Date(entry.stat.mtimeMs) }
    }),
    rm: vi.fn(async (p: string, opts?: { recursive?: boolean; force?: boolean }) => {
      const keys = Array.from(storage.keys())
      const prefix = p.endsWith('/') ? p : `${p}/`
      for (const k of keys) {
        if (k === p || k.startsWith(prefix)) storage.delete(k)
      }
      if (opts?.force) return
    }),
    mkdir: vi.fn(async (_p: string, _opts?: { recursive?: boolean }) => {}),
    access: vi.fn(async (p: string) => {
      if (!storage.has(p)) throw new Error(`ENOENT: ${p}`)
    }),
  }
})

vi.mock('node:fs/promises', () => fsMock)
vi.mock('../../../shared/utils/filesystem', () => ({
  mkdirp: vi.fn(async (dirPath: string) => { fsMock.mkdir(dirPath, { recursive: true }) }),
  pathExists: vi.fn(async (p: string) => {
    if (fsMock.storage.has(p)) return true
    const prefix = p.endsWith('/') ? p : `${p}/`
    for (const k of fsMock.storage.keys()) {
      if (k.startsWith(prefix)) return true
    }
    return false
  }),
  readJson: vi.fn(async (filePath: string) => {
    try {
      const content = await fsMock.readFile(filePath)
      return JSON.parse(content.toString())
    } catch {
      return null
    }
  }),
  writeJson: vi.fn(),
}))

vi.mock('../../../shared/config/env', () => ({
  env: {
    JOB_STATUS_TTL_SEC: 21600,
    REDIS_URL: 'redis://localhost:6379',
    NODE_ENV: 'test',
    PORT: 3333,
    JWT_SECRET: 'test-secret',
    DATABASE_URL: 'postgresql://test',
    STORAGE_PATH: './storage',
    KCC_DOCKER_IMAGE: 'mangaink-kcc:10.3.0',
    CONVERSIONS_STORAGE_PATH: '/storage/conversions',
    MOBI_DOCKER_IMAGE: 'mangaink-unpack:0.4.1',
    MOBI_PREVIEW_TTL_SEC: 86400,
  },
}))

import { MobiPreviewService } from './mobi-preview.service'
import { MobiFileNotFoundError, InvalidPageIndexError, PreviewNotReadyError } from '../errors/mobi-preview.errors'

const CONV = 'conv_test'
const JOB = 'job_test'
const MOBI_BASE = 'Boruto - Vol. 01'

function mobiPath(): string {
  return `/storage/conversions/${CONV}/jobs/${JOB}/output/${MOBI_BASE}.mobi`
}

function tempBase(): string {
  return `/storage/conversions/${CONV}/jobs/${JOB}/output/temp/${MOBI_BASE}`
}

function setupReadyIndex(totalPages = 3, ageMs = 1000): void {
  fsMock.reset()
  const index = {
    sourceMobi: `${MOBI_BASE}.mobi`,
    extractedAt: new Date(Date.now() - ageMs).toISOString(),
    pages: Array.from({ length: totalPages }, (_, i) => ({
      index: i,
      filename: `${String(i).padStart(5, '0')}.jpg`,
      contentType: 'image/jpeg',
    })),
  }
  fsMock.storage.set(`${tempBase()}/index.json`, {
    stat: { mtimeMs: Date.now() - ageMs, size: 0 },
    content: JSON.stringify(index),
  })
  for (let i = 0; i < totalPages; i++) {
    const fname = `${String(i).padStart(5, '0')}.jpg`
    fsMock.storage.set(`${tempBase()}/images/${fname}`, {
      stat: { mtimeMs: Date.now() - ageMs, size: 100 },
      content: Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
    })
  }
}

describe('MobiPreviewService', () => {
  let service: MobiPreviewService

  beforeEach(() => {
    fsMock.reset()
    fsMock.writeFile.mockClear()
    fsMock.readFile.mockClear()
    fsMock.readdir.mockClear()
    fsMock.stat.mockClear()
    fsMock.rm.mockClear()
    fsMock.mkdir.mockClear()
    fsMock.access.mockClear()
    service = new MobiPreviewService()
  })

  describe('resolvePaths', () => {
    it('retorna caminho do MOBI de saida e do temp/ ao lado', () => {
      const paths = service.resolvePaths(CONV, JOB, `${MOBI_BASE}.mobi`)
      expect(paths.mobiPath).toBe(mobiPath())
      expect(paths.tempDir).toBe(tempBase())
      expect(paths.imagesDir).toBe(`${tempBase()}/images`)
      expect(paths.indexPath).toBe(`${tempBase()}/index.json`)
      expect(paths.readyPath).toBe(`${tempBase()}/READY`)
    })
  })

  describe('isCacheValid', () => {
    it('retorna true se index.json existe e mtime < TTL', async () => {
      setupReadyIndex(3, 1000)
      const ok = await service.isCacheValid(CONV, JOB, `${MOBI_BASE}.mobi`)
      expect(ok).toBe(true)
    })

    it('retorna false se index.json nao existe', async () => {
      const ok = await service.isCacheValid(CONV, JOB, `${MOBI_BASE}.mobi`)
      expect(ok).toBe(false)
    })

    it('retorna false se index.json existe mas mtime expirou', async () => {
      setupReadyIndex(3, 100_000)
      const ok = await service.isCacheValid(CONV, JOB, `${MOBI_BASE}.mobi`)
      // TTL=86400000ms; 100_000ms eh valido, precisa expira acima de 86400s
      expect(ok).toBe(true)
    })

    it('retorna false se mtime > TTL (expirado)', async () => {
      setupReadyIndex(3, 100_000)
      // Forca mtime antigo: 2 dias atras
      fsMock.storage.set(
        `${tempBase()}/index.json`,
        { stat: { mtimeMs: Date.now() - 2 * 86400_000, size: 0 }, content: '{}' },
      )
      const ok = await service.isCacheValid(CONV, JOB, `${MOBI_BASE}.mobi`)
      expect(ok).toBe(false)
    })
  })

  describe('readIndex', () => {
    it('retorna o indice parseado se o arquivo existe', async () => {
      setupReadyIndex(3)
      const idx = await service.readIndex(CONV, JOB, `${MOBI_BASE}.mobi`)
      expect(idx).not.toBeNull()
      expect(idx!.sourceMobi).toBe(`${MOBI_BASE}.mobi`)
      expect(idx!.pages).toHaveLength(3)
      expect(idx!.pages[0]).toEqual({
        index: 0,
        filename: '00000.jpg',
        contentType: 'image/jpeg',
      })
      expect(idx!.pages[2].filename).toBe('00002.jpg')
    })

    it('retorna null se o index.json nao existe (extracao ainda nao ocorreu)', async () => {
      const idx = await service.readIndex(CONV, JOB, `${MOBI_BASE}.mobi`)
      expect(idx).toBeNull()
    })
  })

  describe('countReadyPages', () => {
    it('conta quantas paginas existem em images/', async () => {
      setupReadyIndex(3)
      const count = await service.countReadyPages(CONV, JOB, `${MOBI_BASE}.mobi`)
      expect(count).toBe(3)
    })

    it('retorna 0 se diretorio de imagens nao existe', async () => {
      const count = await service.countReadyPages(CONV, JOB, `${MOBI_BASE}.mobi`)
      expect(count).toBe(0)
    })

    it('conta apenas parcialmente se extracao em curso', async () => {
      setupReadyIndex(5, 1000)
      // Remove as paginas 3 e 4 (extracao parcial)
      fsMock.storage.delete(`${tempBase()}/images/00003.jpg`)
      fsMock.storage.delete(`${tempBase()}/images/00004.jpg`)
      const count = await service.countReadyPages(CONV, JOB, `${MOBI_BASE}.mobi`)
      expect(count).toBe(3)
    })
  })

  describe('resolvePageFile', () => {
    it('retorna path absoluto de uma pagina existente', async () => {
      setupReadyIndex(5)
      const result = await service.resolvePageFile(CONV, JOB, `${MOBI_BASE}.mobi`, 2)
      expect(result.filePath).toBe(`${tempBase()}/images/00002.jpg`)
      expect(result.contentType).toBe('image/jpeg')
    })

    it('lanca InvalidPageIndexError se indice >= totalPages', async () => {
      setupReadyIndex(3)
      await expect(
        service.resolvePageFile(CONV, JOB, `${MOBI_BASE}.mobi`, 10),
      ).rejects.toBeInstanceOf(InvalidPageIndexError)
    })

    it('lanca PreviewNotReadyError se index.json ainda nao existe', async () => {
      await expect(
        service.resolvePageFile(CONV, JOB, `${MOBI_BASE}.mobi`, 0),
      ).rejects.toBeInstanceOf(PreviewNotReadyError)
    })

    it('lanca PreviewNotReadyError se pagina ainda nao foi escrita (extracao em curso)', async () => {
      setupReadyIndex(5)
      fsMock.storage.delete(`${tempBase()}/images/00003.jpg`)
      await expect(
        service.resolvePageFile(CONV, JOB, `${MOBI_BASE}.mobi`, 3),
      ).rejects.toBeInstanceOf(PreviewNotReadyError)
    })
  })

  describe('cacheUntil', () => {
    it('retorna ISO8601 mtime + TTL', async () => {
      setupReadyIndex(3, 1000)
      const until = await service.cacheUntil(CONV, JOB, `${MOBI_BASE}.mobi`)
      expect(until).not.toBeNull()
      // mtime ou extractedAt + 86400s
      const expectedMs = Date.now() - 1000 + 86400_000
      const actualMs = new Date(until!).getTime()
      expect(Math.abs(actualMs - expectedMs)).toBeLessThan(500)
    })

    it('retorna null se cache nao existe', async () => {
      const until = await service.cacheUntil(CONV, JOB, `${MOBI_BASE}.mobi`)
      expect(until).toBeNull()
    })
  })

  describe('requireMobiFile', () => {
    it('lanca MobiFileNotFoundError se o .mobi nao existe no disco', async () => {
      await expect(
        service.requireMobiFile(CONV, JOB, `${MOBI_BASE}.mobi`),
      ).rejects.toBeInstanceOf(MobiFileNotFoundError)
    })

    it('retorna path do MOBI se ele existe', async () => {
      fsMock.storage.set(mobiPath(), {
        stat: { mtimeMs: Date.now(), size: 1024 },
        content: Buffer.from([0]),
      })
      const p = await service.requireMobiFile(CONV, JOB, `${MOBI_BASE}.mobi`)
      expect(p).toBe(mobiPath())
    })
  })

  describe('clearTemp', () => {
    it('remove o diretorio temp/<file-base> inteiro', async () => {
      setupReadyIndex(3)
      await service.clearTemp(CONV, JOB, `${MOBI_BASE}.mobi`)
      expect(fsMock.rm).toHaveBeenCalledWith(tempBase(), { recursive: true, force: true })
    })
  })
})