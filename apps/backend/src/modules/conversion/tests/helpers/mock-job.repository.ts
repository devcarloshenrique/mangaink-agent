import type { ConversionJobConfig, ConversionJobStatus, ConversionJobState } from '../../types/conversion.types'
import type { ConversionJobRepository } from '../../repositories/conversion-job.repository'

/**
 * Job repository mock.
 * Registra todos os jobs criados em uma lista plana para inspeção nos testes.
 */
export class MockJobRepository implements ConversionJobRepository {
  public created: ConversionJobState[] = []
  public updated: Array<{ jobId: string; updates: Partial<ConversionJobStatus> }> = []

  async create(job: ConversionJobState): Promise<void> {
    this.created.push(job)
  }

  async findById(jobId: string): Promise<ConversionJobState | null> {
    return this.created.find((j) => j.jobId === jobId) ?? null
  }

  async update(jobId: string, updates: Partial<ConversionJobStatus>): Promise<void> {
    this.updated.push({ jobId, updates })
  }

  async delete(_jobId: string): Promise<void> {}

  async appendLog(_jobId: string, _message: string): Promise<void> {}

  reset(): void {
    this.created = []
    this.updated = []
  }
}
