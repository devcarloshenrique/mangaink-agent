import type { SourceInspectJob } from '../../types/source.types'
import type { InspectQueueService } from '../../services/inspect-queue.service'

export class MockInspectQueueService {
  enqueuedJobs: SourceInspectJob[] = []

  async enqueue(job: SourceInspectJob): Promise<void> {
    this.enqueuedJobs.push(job)
  }

  getQueueName(): string {
    return 'source-inspect-test'
  }

  reset(): void {
    this.enqueuedJobs = []
  }
}

export type IInspectQueueService = Pick<InspectQueueService, 'enqueue' | 'getQueueName'>