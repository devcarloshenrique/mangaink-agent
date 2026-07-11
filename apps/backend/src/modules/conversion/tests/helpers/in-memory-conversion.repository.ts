import type {
  ConversionConfig,
  ConversionStatusFile,
  ConversionState,
  ConversionStatus,
} from '../../types/conversion.types'
import type { ConversionRepository } from '../../repositories/conversion.repository'

export class InMemoryConversionRepository implements ConversionRepository {
  public store = new Map<string, ConversionState>()
  public logs: string[] = []

  async create(state: ConversionState): Promise<void> {
    this.store.set(state.conversionId, { ...state })
  }

  async findById(conversionId: string): Promise<ConversionState | null> {
    const entry = this.store.get(conversionId)
    return entry ? { ...entry } : null
  }

  async update(
    conversionId: string,
    updates: Partial<ConversionStatusFile>,
  ): Promise<void> {
    const existing = this.store.get(conversionId)
    if (!existing) return
    this.store.set(conversionId, {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    })
  }

  async syncStatus(conversionId: string): Promise<ConversionState | null> {
    const existing = this.store.get(conversionId)
    if (!existing) return null

    // Simula recomputação: mantém os dados que já estão em memória
    const jobs = existing.jobs ?? []
    const totalJobs = jobs.length
    const completedJobs = jobs.filter((j) => j.status === 'completed').length
    const failedJobs = jobs.filter((j) => j.status === 'failed' || j.status === 'cancelled').length
    const runningJobs = jobs.filter((j) =>
      ['preparing', 'downloading', 'converting', 'packaging'].includes(j.status),
    ).length
    const pendingJobs = jobs.filter((j) => j.status === 'queued').length

    let status: ConversionStatus = 'queued'
    if (jobs.length === 0) status = 'queued'
    else if (jobs.every((j) => j.status === 'completed')) status = 'completed'
    else if (jobs.every((j) => j.status === 'cancelled')) status = 'cancelled'
    else if (jobs.every((j) => j.status === 'failed')) status = 'failed'
    else if (
      jobs.some((j) => j.status === 'completed' || j.status === 'failed' || j.status === 'cancelled')
    )
      status = 'partial'
    else if (
      jobs.some((j) =>
        ['preparing', 'downloading', 'converting', 'packaging'].includes(j.status),
      )
    )
      status = 'processing'

    const progress =
      totalJobs === 0
        ? 0
        : Math.round((jobs.reduce((acc, j) => acc + j.progress, 0) / totalJobs))

    const now = new Date().toISOString()
    const isTerminal = ['completed', 'failed', 'cancelled'].includes(status)

    const updated: ConversionState = {
      ...existing,
      status,
      progress,
      totalJobs,
      completedJobs,
      failedJobs,
      runningJobs,
      pendingJobs,
      jobs,
      updatedAt: now,
      ...(isTerminal ? { finishedAt: now } : {}),
    }
    this.store.set(conversionId, updated)
    return { ...updated }
  }

  async listJobIds(conversionId: string): Promise<string[]> {
    const existing = this.store.get(conversionId)
    return existing?.jobs?.map((j) => j.jobId) ?? []
  }

  async appendLog(conversionId: string, message: string): Promise<void> {
    this.logs.push(`[${conversionId}] ${message}`)
  }

  async delete(conversionId: string): Promise<void> {
    this.store.delete(conversionId)
  }

  reset(): void {
    this.store.clear()
    this.logs = []
  }
}
