import { createRedisQueueAdapter } from '../../../shared/infra/factory'
import type { IQueueService } from '../../../shared/infra/queue.service'
import type { ChapterDownloadData } from '../types/chapter-download.types'

const QUEUE_NAME = 'chapter-download'

let _queue: IQueueService<ChapterDownloadData> | null = null

/**
 * Injeta a fila concreta de download de capítulos (chamada pelo composition
 * root). Enquanto não injetada, `getChapterDownloadQueue()` cria um adapter
 * default (modo web) — comportamento legado preservado.
 */
export function setChapterDownloadQueue(queue: IQueueService<ChapterDownloadData>): void {
  _queue = queue
}

/** Retorna a fila de download de capítulos (singleton). */
export function getChapterDownloadQueue(): IQueueService<ChapterDownloadData> {
  if (!_queue) {
    _queue = createRedisQueueAdapter(QUEUE_NAME)
  }
  return _queue
}
