import { describe, expect, it, vi } from 'vitest'

vi.mock('../../redis/safe-redis', () => ({
  createSafeRedis: vi.fn(),
}))

/**
 * Garante que os módulos de worker e o server NÃO criam conexão Redis no load
 * (apenas no start). Em modo embedded isso desbloqueia o backend embarcado no
 * desktop, que não tem Redis disponível.
 */
describe('no-redis-workers-embedded: módulos de worker/server não conectam Redis no load', () => {
  it('importar shared/server + os 5 workers em modo embedded não toca createSafeRedis', async () => {
    vi.stubEnv('MI_EMBEDDED_MODE', '1')
    vi.resetModules()

    const { createSafeRedis } = await import('../../redis/safe-redis')
    const server = await import('../../server')
    const inspectSource = await import('../../../modules/scraping/workers/inspect-source.worker')
    const conversionJob = await import('../../../modules/conversion/workers/conversion-job.worker')
    const downloadOnly = await import('../../../modules/conversion/workers/download-only.worker')
    const mobiPreview = await import('../../../modules/conversion/workers/mobi-preview.worker')
    const chapterDownload = await import('../../../modules/scraping/workers/chapter-download.worker')

    expect(server.createServer).toBeTypeOf('function')
    expect(inspectSource.startInspectSourceWorker).toBeTypeOf('function')
    expect(conversionJob.startConversionJobWorker).toBeTypeOf('function')
    expect(downloadOnly.startDownloadOnlyWorker).toBeTypeOf('function')
    expect(mobiPreview.startMobiPreviewWorker).toBeTypeOf('function')
    expect(chapterDownload.startChapterDownloadWorker).toBeTypeOf('function')

    expect(createSafeRedis).not.toHaveBeenCalled()

    vi.unstubAllEnvs()
  })
})
