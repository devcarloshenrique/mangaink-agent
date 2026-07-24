import { getSourceRepository } from '../../../shared/database/repositories'
import { getChapterDownloadQueue } from '../services/chapter-download-queue.service'
import { ChapterImageService } from '../services/chapter-image.service'
import { resolveProvider } from '../utils/resolve-provider'
import { getJobStatus, setJobStatus } from '../services/chapter-download-status-store'
import { env } from '../../../shared/config/env'
import { SourceNotFoundError } from '../errors/scraping.errors'
import { ChapterNotFoundError } from '../errors/chapter-download.errors'
import type { ChapterDownloadStatus } from '../types/chapter-download.types'

export interface CreateChapterDownloadResult {
  jobId: string
  status: ChapterDownloadStatus
}

export class CreateChapterDownloadUseCase {
  async execute(sourceId: string, chapterId: string): Promise<CreateChapterDownloadResult> {
    const source = await getSourceRepository().load(sourceId)
    if (!source) {
      throw new SourceNotFoundError(sourceId)
    }

    const chapter = source.chapters.find((c) => c.id === chapterId)
    if (!chapter) {
      throw new ChapterNotFoundError(sourceId, chapterId)
    }

    const provider = await resolveProvider(sourceId)
    if (!provider) {
      throw new SourceNotFoundError(sourceId)
    }

    const service = new ChapterImageService(provider, sourceId, chapterId, env.STORAGE_PATH)

    // 1. Cache completo — não enfileira
    if (await service.isCached()) {
      return { jobId: '', status: 'ready' }
    }

    // 2. Verifica se já existe job ativo no Redis
    const existing = await getJobStatus(sourceId, chapterId)

    if (existing) {
      // Job queued ou downloading — retorna o job existente (idempotência)
      if (existing.status === 'queued' || existing.status === 'downloading') {
        return { jobId: existing.jobId, status: 'downloading' }
      }

      // Job completed — cache já deve existir (ou worker terminou sem gravar todas)
      if (existing.status === 'completed') {
        if (await service.isCached()) {
          return { jobId: '', status: 'ready' }
        }
        // Cache não está completo apesar do job completed — enfileirar novamente
      }

      // Job failed — re-enfileira (retry)
    }

    // 3. Sem job ativo, sem cache — enfileira novo job
    const queue = getChapterDownloadQueue()
    const job = await queue.add('download', { sourceId, chapterId })
    const jobId = job.id ?? ''

    // Registra no Redis Hash para idempotência de requisições subsequentes
    await setJobStatus(sourceId, chapterId, jobId, 'queued')

    return { jobId, status: 'queued' }
  }
}
