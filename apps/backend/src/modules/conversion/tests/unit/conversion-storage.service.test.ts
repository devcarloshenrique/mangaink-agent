import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import type { RmOptions } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { logger } from '../../../../shared/logging/logger'

const shared = vi.hoisted(() => ({
  rmMock: vi.fn(),
  realRm: undefined as unknown as typeof rm,
}))

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>()
  shared.realRm = actual.rm
  return {
    ...actual,
    rm: ((...args: Parameters<typeof rm>) => shared.rmMock(...args)) as typeof rm,
  }
})

vi.mock('../../../../shared/config/env', () => ({
  env: { CONVERSIONS_STORAGE_PATH: '' },
}))

import { ConversionStorageService } from '../../services/conversion-storage.service'
import { env } from '../../../../shared/config/env'

describe('ConversionStorageService', () => {
  let base: string
  let loggerErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(async () => {
    base = await mkdtemp(join(tmpdir(), 'conv-storage-test-'))
    env.CONVERSIONS_STORAGE_PATH = base
    shared.rmMock.mockClear()
    shared.rmMock.mockImplementation((path: string, opts?: RmOptions) =>
      shared.realRm(path, opts),
    )
    loggerErrorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {})
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await rm(base, { recursive: true, force: true })
  })

  it('resolve o diretÃ³rio da conversÃ£o sob CONVERSIONS_STORAGE_PATH', () => {
    const service = new ConversionStorageService()
    expect(service.conversionDir('conv_001')).toBe(join(base, 'conv_001'))
  })

  it('remove recursivamente outputs, logs e previews temporÃ¡rios da conversÃ£o', async () => {
    const convDir = join(base, 'conv_001')
    await mkdir(join(convDir, 'jobs', 'job_001', 'output', 'temp', 'vol-01', 'images'), {
      recursive: true,
    })
    await writeFile(join(convDir, 'config.json'), '{}')
    await writeFile(join(convDir, 'status.json'), '{}')
    await mkdir(join(convDir, 'logs'), { recursive: true })
    await writeFile(join(convDir, 'logs', 'conversion.log'), 'log')
    await writeFile(join(convDir, 'jobs', 'job_001', 'output', 'Vol 1.epub'), 'epub')
    await writeFile(join(convDir, 'jobs', 'job_001', 'output', 'temp', 'vol-01', 'index.json'), '{}')
    await writeFile(
      join(convDir, 'jobs', 'job_001', 'output', 'temp', 'vol-01', 'images', '00001.jpg'),
      'img',
    )

    const service = new ConversionStorageService()
    const removed = await service.removeConversion('conv_001')

    expect(removed).toBe(true)
    await expect(rm(join(base, 'conv_001'), { recursive: true })).rejects.toThrow()
    expect(loggerErrorSpy).not.toHaveBeenCalled()
  })

  it('retorna true sem erro quando o diretÃ³rio nÃ£o existe', async () => {
    const service = new ConversionStorageService()
    const removed = await service.removeConversion('conv_inexistente')

    expect(removed).toBe(true)
    expect(shared.rmMock).not.toHaveBeenCalled()
  })

  it('fallback: se a remoÃ§Ã£o falhar, retorna false e registra log sem lanÃ§ar', async () => {
    await mkdir(join(base, 'conv_002'))
    shared.rmMock.mockImplementation(() => Promise.reject(new Error('EACCES')))

    const service = new ConversionStorageService()
    let thrown = false
    let removed = false
    try {
      removed = await service.removeConversion('conv_002')
    } catch {
      thrown = true
    }

    expect(thrown).toBe(false)
    expect(removed).toBe(false)
    expect(loggerErrorSpy).toHaveBeenCalled()
  })
})
