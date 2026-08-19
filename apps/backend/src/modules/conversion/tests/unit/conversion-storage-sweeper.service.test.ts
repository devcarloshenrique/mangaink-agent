import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { access, mkdir, mkdtemp, rm, utimes, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  ConversionStorageSweeper,
  type ConversionExistenceChecker,
} from '../../services/conversion-storage-sweeper.service'

vi.mock('../../../../shared/config/env', () => ({
  env: {
    CONVERSIONS_STORAGE_PATH: '/test/storage/conversions',
    STORAGE_SWEEPER_MIN_ORPHAN_AGE_MS: 24 * 60 * 60 * 1000,
    STORAGE_SWEEPER_INTERVAL_MS: 6 * 60 * 60 * 1000,
  },
}))

const OLD = new Date(Date.now() - 48 * 60 * 60 * 1000)

function makeChecker(known: string[]): ConversionExistenceChecker {
  return {
    listKnownConversionIds: vi.fn(async () => new Set(known)),
  }
}

async function setOldMtime(dirPath: string): Promise<void> {
  await utimes(dirPath, OLD, OLD)
}

async function expectDirExists(dirPath: string): Promise<void> {
  await expect(access(dirPath)).resolves.toBeUndefined()
}

async function expectDirMissing(dirPath: string): Promise<void> {
  await expect(access(dirPath)).rejects.toThrow()
}

describe('ConversionStorageSweeper', () => {
  let base: string

  beforeEach(async () => {
    base = await mkdtemp(join(tmpdir(), 'conv-sweeper-test-'))
  })

  afterEach(async () => {
    await rm(base, { recursive: true, force: true })
  })

  it('remove recursivamente diretórios órfãos (sem registro no banco) acima da idade mínima', async () => {
    await mkdir(join(base, 'orphan_1', 'jobs', 'job', 'output'), { recursive: true })
    await writeFile(join(base, 'orphan_1', 'config.json'), '{}')
    await mkdir(join(base, 'orphan_2'))
    await mkdir(join(base, 'active_1'))
    await setOldMtime(join(base, 'orphan_1'))
    await setOldMtime(join(base, 'orphan_2'))
    await setOldMtime(join(base, 'active_1'))

    const sweeper = new ConversionStorageSweeper(
      makeChecker(['active_1']),
      base,
      24 * 60 * 60 * 1000,
    )

    const result = await sweeper.sweep()

    expect(result.removed.sort()).toEqual(['orphan_1', 'orphan_2'])
    expect(result.kept).toBe(1)
    expect(result.skipped).toEqual([])
    expect(result.errors).toEqual([])
    await expectDirMissing(join(base, 'orphan_1'))
    await expectDirMissing(join(base, 'orphan_2'))
    await expectDirExists(join(base, 'active_1'))
  })

  it('não remove conversões existentes no banco mesmo acima da idade mínima', async () => {
    await mkdir(join(base, 'conv_live'))
    await setOldMtime(join(base, 'conv_live'))

    const sweeper = new ConversionStorageSweeper(
      makeChecker(['conv_live']),
      base,
      24 * 60 * 60 * 1000,
    )

    const result = await sweeper.sweep()

    expect(result.removed).toEqual([])
    expect(result.kept).toBe(1)
    await expectDirExists(join(base, 'conv_live'))
  })

  it('ignora diretórios recentes (grace period) mesmo sem registro no banco', async () => {
    await mkdir(join(base, 'fresh_dir'))

    const sweeper = new ConversionStorageSweeper(
      makeChecker([]),
      base,
      24 * 60 * 60 * 1000,
    )

    const result = await sweeper.sweep()

    expect(result.removed).toEqual([])
    expect(result.skipped).toEqual(['fresh_dir'])
    await expectDirExists(join(base, 'fresh_dir'))
  })

  it('não lança quando a raiz do storage não existe', async () => {
    const missingRoot = join(base, 'nao-existe')
    const sweeper = new ConversionStorageSweeper(makeChecker([]), missingRoot, 24 * 60 * 60 * 1000)

    const result = await sweeper.sweep()

    expect(result).toEqual({ scanned: 0, removed: [], kept: 0, skipped: [], errors: [] })
  })

  it('registra erro e continua quando a consulta ao banco falha', async () => {
    await mkdir(join(base, 'dir_a'))
    await setOldMtime(join(base, 'dir_a'))
    const failingChecker: ConversionExistenceChecker = {
      listKnownConversionIds: vi.fn(async () => {
        throw new Error('connection refused')
      }),
    }

    const sweeper = new ConversionStorageSweeper(failingChecker, base, 24 * 60 * 60 * 1000)
    const result = await sweeper.sweep()

    expect(result.removed).toEqual([])
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain('connection refused')
    await expectDirExists(join(base, 'dir_a'))
  })
})
