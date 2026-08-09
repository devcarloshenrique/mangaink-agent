import type { MobiPreviewJobData } from '../use-cases/mobi-preview.use-case'
import type { MobiPreviewService } from '../services/mobi-preview.service'
import type { MobiPreviewStatusStore } from '../../../shared/redis/mobi-preview-status-store'
import type { MobiUnpackRunner } from '../services/mobi-unpack-runner.service'
import type { ConversionJobRepository } from '../repositories/conversion-job.repository'
import { MobiExtractionError } from '../errors/mobi-preview.errors'
import { createMobiUnpackRunner } from '../services/mobi-unpack-runner.factory'
import { getConversionJobRepository } from '../../../shared/database/repositories'
import { MobiPreviewService as MobiPreviewServiceImpl } from '../services/mobi-preview.service'
import { MobiPreviewStatusStore as MobiPreviewStatusStoreImpl } from '../../../shared/redis/mobi-preview-status-store'
import type { RuntimeAdapters } from '../../../shared/infra/factory'
import {
  startQueueWorker,
  type QueueWorkerHandle,
  type QueueWorkerJob,
} from '../../../shared/infra/queue-worker'

/** Dependencias injetaveis no processMobiPreviewJob (para teste). */
export interface MobiPreviewWorkerDeps {
  service: MobiPreviewService
  store: MobiPreviewStatusStore
  runner: MobiUnpackRunner
  jobs: ConversionJobRepository
}

/**
 * Orquestracao da extracao de preview MOBI, isolada do BullMQ para testes.
 *
 * Passos:
 *  1. Limpa temp/ (evita paginas de extracoes anteriores)
 *  2. Marca status='extracting' no Redis Hash
 *  3. Chama runner.run; callback onTick atualiza Redis com readyPages parciais
 *  4. Em sucesso: le index.json, seta status='ready' com totalPages/readyPages
 *  5. Em falha: seta status='failed' com erro e relanca MobiExtractionError
 */
export async function processMobiPreviewJob(
  data: MobiPreviewJobData,
  deps: MobiPreviewWorkerDeps,
): Promise<void> {
  const { conversionId, jobId, outputFile } = data
  const { service, store, runner, jobs } = deps

  await jobs.appendLog(jobId, `Preview MOBI: extracao iniciada — source="${outputFile}"`)

  await service.clearTemp(conversionId, jobId, outputFile)

  await store.set(jobId, {
    status: 'extracting',
    totalPages: 0,
    readyPages: 0,
    currentStep: 'Extraindo paginas do MOBI',
    updatedAt: new Date().toISOString(),
  })

  const { mobiPath, tempDir } = service.resolvePaths(conversionId, jobId, outputFile)

  const onTick = async () => {
    const totalPages = (await service.readIndex(conversionId, jobId, outputFile))?.pages.length ?? 0
    const readyPages = await service.countReadyPages(conversionId, jobId, outputFile)
    await store.set(jobId, {
      status: 'extracting',
      totalPages,
      readyPages,
      updatedAt: new Date().toISOString(),
    })
  }

  try {
    await runner.run({
      jobId,
      mobiPath,
      outputDir: tempDir,
      onTick,
    })

    const index = await service.readIndex(conversionId, jobId, outputFile)
    const totalPages = index?.pages.length ?? 0
    const readyPages = await service.countReadyPages(conversionId, jobId, outputFile)

    await store.set(jobId, {
      status: 'ready',
      totalPages,
      readyPages,
      currentStep: 'Done',
      updatedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    })

    await jobs.appendLog(jobId, `Preview MOBI: extração concluída — ${readyPages} página(s)`)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await store.set(jobId, {
      status: 'failed',
      error: message,
      updatedAt: new Date().toISOString(),
    })
    await jobs.appendLog(jobId, `Preview MOBI: extração falhou — ${message}`)
    throw new MobiExtractionError(jobId, message, (err as { cause?: unknown })?.cause)
  }
}

/**
 * Worker BullMQ real de preview MOBI (fila `mobi-preview`, concorrência 1).
 *
 * Factory: constrói service, status store (do runtime), runner e repo a partir
 * das dependências injetadas — NENHUMA conexão é aberta no load do módulo.
 */
export function startMobiPreviewWorker(deps: {
  runtime: RuntimeAdapters
  mobiUnpackRunnerFactory?: () => MobiUnpackRunner
}): QueueWorkerHandle {
  const { runtime, mobiUnpackRunnerFactory = createMobiUnpackRunner } = deps

  const workerDeps: MobiPreviewWorkerDeps = {
    service: new MobiPreviewServiceImpl(),
    store: new MobiPreviewStatusStoreImpl(runtime.status),
    runner: mobiUnpackRunnerFactory(),
    jobs: getConversionJobRepository(),
  }

  return startQueueWorker({
    runtime,
    queueName: 'mobi-preview',
    concurrency: 1,
    processor: async (job: QueueWorkerJob) => {
      await processMobiPreviewJob(job.data as MobiPreviewJobData, workerDeps)
    },
  })
}
