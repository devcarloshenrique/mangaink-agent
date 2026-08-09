import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  getChapterDownloadQueue,
  setChapterDownloadQueue,
} from '../../services/chapter-download-queue.service'
import type { IQueueService } from '../../../../shared/infra/queue.service'
import type { ChapterDownloadData } from '../../types/chapter-download.types'

function makeMockQueue() {
  return {
    add: vi.fn(async () => ({
      id: 'job-1',
      name: 'download',
      data: {} as ChapterDownloadData,
      attemptsMade: 0,
    })),
    getJob: vi.fn(),
    removeJob: vi.fn(),
  }
}

describe('ChapterDownloadQueue', () => {
  beforeEach(() => {
    setChapterDownloadQueue(makeMockQueue())
  })

  it('getChapterDownloadQueue retorna a fila definida por setChapterDownloadQueue', () => {
    const queue = makeMockQueue()
    setChapterDownloadQueue(queue)
    expect(getChapterDownloadQueue()).toBe(queue)
  })

  it('delega add para a fila injetada com nome download e dados do capítulo', async () => {
    const mockQueue = makeMockQueue()
    setChapterDownloadQueue(mockQueue)

    const job = await getChapterDownloadQueue().add('download', {
      sourceId: 'src-001',
      chapterId: 'chap_0001',
    })

    expect(mockQueue.add).toHaveBeenCalledWith('download', {
      sourceId: 'src-001',
      chapterId: 'chap_0001',
    })
    expect(job.id).toBe('job-1')
  })

  it('removeJob e getJob são delegados à fila injetada', async () => {
    const mockQueue = makeMockQueue()
    setChapterDownloadQueue(mockQueue)
    const queue = getChapterDownloadQueue()

    mockQueue.getJob.mockResolvedValue(null)
    await queue.getJob('job-1')
    expect(mockQueue.getJob).toHaveBeenCalledWith('job-1')

    await queue.removeJob('job-1')
    expect(mockQueue.removeJob).toHaveBeenCalledWith('job-1')
  })
})
