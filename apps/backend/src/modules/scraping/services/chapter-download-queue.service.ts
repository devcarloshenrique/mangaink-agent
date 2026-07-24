import { Queue } from 'bullmq'
import { createQueue } from '../../../shared/redis/bullmq'
import type { ChapterDownloadData } from '../types/chapter-download.types'

let _queue: Queue<ChapterDownloadData> | null = null

export function getChapterDownloadQueue(): Queue<ChapterDownloadData> {
  if (!_queue) {
    _queue = createQueue<ChapterDownloadData>('chapter-download')
  }
  return _queue
}
