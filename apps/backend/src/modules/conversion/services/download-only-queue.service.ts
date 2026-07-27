import { createQueue } from '../../../shared/redis/bullmq'
import type { ConversionJobData } from '../types/conversion.types'
import type { Job } from 'bullmq'

export class DownloadOnlyQueueService {
  private readonly queue = createQueue<ConversionJobData>('download-only')

  async enqueue(data: ConversionJobData): Promise<Job<ConversionJobData>> {
    return this.queue.add(`download-only:${data.jobId}`, data, {
      jobId: data.jobId,
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: { count: 50 },
      removeOnFail: { count: 25 },
    })
  }

  async remove(jobId: string): Promise<void> {
    const job = await this.queue.getJob(jobId)
    if (job) {
      await job.remove()
    }
  }

  async getJob(jobId: string): Promise<Job<ConversionJobData> | undefined> {
    const job = await this.queue.getJob(jobId)
    return job ?? undefined
  }

  async close(): Promise<void> {
    await this.queue.close()
  }
}
