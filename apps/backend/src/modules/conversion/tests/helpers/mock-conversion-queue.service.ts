import type { ConversionJobData } from '../../types/conversion.types'
import type { ConversionQueueService } from '../../services/conversion-queue.service'

export class MockConversionQueueService {
  public enqueued: ConversionJobData[] = []
  public removed: string[] = []

  async enqueue(data: ConversionJobData): Promise<ConversionJobData> {
    this.enqueued.push(data)
    return data
  }

  async remove(jobId: string): Promise<void> {
    this.removed.push(jobId)
  }

  async getJob(_jobId: string): Promise<ConversionJobData | undefined> {
    return this.enqueued.find((d) => d.jobId === _jobId)
  }

  async close(): Promise<void> {}

  reset(): void {
    this.enqueued = []
    this.removed = []
  }
}
