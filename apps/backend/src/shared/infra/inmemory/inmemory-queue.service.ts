import { randomUUID } from 'node:crypto'
import type {
  IQueueService,
  QueueAddOptions,
  QueueConcurrencyOptions,
  QueueJob,
} from '../queue.service'

/** Função que processa um único job. Pode ser síncrona ou assíncrona. */
export interface QueueProcessor<T = unknown> {
  (job: QueueJob<T>): Promise<void> | void
}

/** Entrada interna da fila — associa o job visível a metadados de execução. */
interface JobEntry<T> {
  job: QueueJob<T>
  attempts: number
  backoff?: { type: 'exponential'; delay: number }
  removeOnComplete?: boolean | number | { count: number }
  removeOnFail?: boolean | number | { count: number }
  phase: 'open' | 'closed'
  retryTimer?: ReturnType<typeof setTimeout>
}

/** Opções de construção da fila in-memory. */
export interface InMemoryQueueOptions {
  /** Padrão de tentativas por job quando `attempts` não é informado. */
  defaultAttempts?: number
  /** Padrão de retenção de jobs completos quando `removeOnComplete` não é informado. */
  defaultCompletedRetention?: number
  /** Padrão de retenção de jobs falhos quando `removeOnFail` não é informado. */
  defaultFailedRetention?: number
}

/**
 * Adaptador in-memory de {@link IQueueService} que espelha a semântica do
 * BullMQ (uma instância = uma fila; o loop de processamento é um "Worker").
 *
 * - FIFO por instância, com concorrência configurável no `process()`.
 * - Retry com backoff exponencial (`delay * 2^(attemptsMade - 1)`).
 * - `close()` drena jobs pendentes/in-flight pré-close; jobs enfileirados após
 *   `close()` ficam visíveis (via `getJob`) mas não são processados.
 * - Retries com backoff ainda não disparados no momento do `close()` são
 *   descartados (o loop parado não os consome).
 * - Callbacks de ciclo de vida opcionais: `onCompleted` e `onFailed`.
 */
export class InMemoryQueueService<T = unknown> implements IQueueService<T> {
  private readonly defaultAttempts: number
  private readonly defaultCompletedRetention: number
  private readonly defaultFailedRetention: number

  private readonly pending: JobEntry<T>[] = []
  private readonly completed: JobEntry<T>[] = []
  private readonly failed: JobEntry<T>[] = []
  private readonly registry = new Map<string, JobEntry<T>>()
  private readonly inflight = new Set<Promise<unknown>>()

  private processor?: QueueProcessor<T>
  private concurrency = 1
  private pumping = false
  private phase: 'open' | 'closed' = 'open'
  private active = 0

  /** Callback chamado quando um job é concluído com sucesso. */
  onCompleted?: (job: QueueJob<T>) => void
  /** Callback chamado quando um job esgota as tentativas e falha. */
  onFailed?: (job: QueueJob<T>, error: unknown) => void

  constructor(options: InMemoryQueueOptions = {}) {
    this.defaultAttempts = options.defaultAttempts ?? 3
    this.defaultCompletedRetention = options.defaultCompletedRetention ?? 100
    this.defaultFailedRetention = options.defaultFailedRetention ?? 50
  }

  /**
   * Enfileira um job. `name` é um rótulo; o ID vem de `opts.jobId` ou é
   * gerado automaticamente. Após `close()`, o job é enfileirado normalmente
   * (visível via `getJob`), mas o loop parado não o processa.
   */
  async add(name: string, data: T, opts?: QueueAddOptions): Promise<QueueJob<T>> {
    const job: QueueJob<T> = {
      id: opts?.jobId ?? randomUUID(),
      name,
      data,
      attemptsMade: 0,
    }
    const entry: JobEntry<T> = {
      job,
      attempts: opts?.attempts ?? this.defaultAttempts,
      backoff: opts?.backoff,
      removeOnComplete: opts?.removeOnComplete,
      removeOnFail: opts?.removeOnFail,
      phase: this.phase,
    }
    this.registry.set(job.id, entry)
    this.pending.push(entry)
    if (this.phase === 'open') void this.pump()
    return job
  }

  /** Busca um job pelo ID (independente do estado: pendente, ativo ou retido). */
  async getJob(jobId: string): Promise<QueueJob<T> | null> {
    return this.registry.get(jobId)?.job ?? null
  }

  /**
   * Remove um job ainda pendente (que ainda não começou). Um job já em voo
   * (processando) não é interrompido; um retry com backoff ainda agendado
   * também é cancelado.
   */
  async removeJob(jobId: string): Promise<void> {
    const entry = this.registry.get(jobId)
    if (!entry) return
    const idx = this.pending.indexOf(entry)
    if (idx !== -1) {
      this.pending.splice(idx, 1)
    } else if (entry.retryTimer) {
      clearTimeout(entry.retryTimer)
      entry.retryTimer = undefined
    } else {
      return
    }
    this.registry.delete(jobId)
  }

  /**
   * Inicia o loop de processamento (idempotente). A concorrência é definida
   * aqui — como no Worker do BullMQ — e não no `add()`. Chamadas após
   * `close()` são ignoradas.
   */
  async process(processor: QueueProcessor<T>, opts?: QueueConcurrencyOptions): Promise<void> {
    if (this.phase === 'closed' || this.processor) return
    this.processor = processor
    this.concurrency = opts?.concurrency ?? 1
    void this.pump()
  }

  /**
   * Para o loop. Jobs em voo terminam e jobs pendentes pré-close são drenados;
   * jobs enfileirados após `close()` não são processados. Idempotente.
   */
  async close(): Promise<void> {
    if (this.phase === 'closed') return
    this.phase = 'closed'
    await this.drain()
  }

  /** Diagnóstico: número de jobs completos retidos (bounded pela retenção). */
  getCompletedCount(): number {
    return this.completed.length
  }

  /** Diagnóstico: número de jobs falhos retidos (bounded pela retenção). */
  getFailedCount(): number {
    return this.failed.length
  }

  private async pump(): Promise<void> {
    if (this.pumping || !this.processor) return
    this.pumping = true
    try {
      while (this.active < this.concurrency) {
        const idx = this.pending.findIndex((entry) => entry.phase === 'open')
        if (idx === -1) break
        const [entry] = this.pending.splice(idx, 1)
        this.runJob(entry)
      }
    } finally {
      this.pumping = false
    }
  }

  private runJob(entry: JobEntry<T>): void {
    this.active += 1
    const promise = this.executeJob(entry)
    this.inflight.add(promise)
    promise.finally(() => {
      this.inflight.delete(promise)
      this.active -= 1
      void this.pump()
    })
  }

  private async executeJob(entry: JobEntry<T>): Promise<void> {
    try {
      await this.processor!(entry.job)
      this.complete(entry)
    } catch (error) {
      entry.job.attemptsMade += 1
      if (entry.job.attemptsMade < entry.attempts) {
        this.scheduleRetry(entry)
        return
      }
      this.fail(entry, error)
    }
  }

  private scheduleRetry(entry: JobEntry<T>): void {
    const delay = entry.backoff ? this.computeBackoff(entry) : 0
    if (delay > 0) {
      entry.retryTimer = setTimeout(() => {
        entry.retryTimer = undefined
        if (this.phase === 'closed') return
        this.pending.push(entry)
        void this.pump()
      }, delay)
      return
    }
    this.pending.push(entry)
    void this.pump()
  }

  private computeBackoff(entry: JobEntry<T>): number {
    return entry.backoff!.delay * 2 ** (entry.job.attemptsMade - 1)
  }

  private complete(entry: JobEntry<T>): void {
    this.completed.push(entry)
    const cap =
      typeof entry.removeOnComplete === 'number'
        ? entry.removeOnComplete
        : typeof entry.removeOnComplete === 'boolean'
          ? (entry.removeOnComplete ? 0 : this.defaultCompletedRetention)
          : (entry.removeOnComplete?.count ?? this.defaultCompletedRetention)
    while (this.completed.length > cap) {
      const evicted = this.completed.shift()!
      this.registry.delete(evicted.job.id)
    }
    this.onCompleted?.(entry.job)
  }

  private fail(entry: JobEntry<T>, error: unknown): void {
    this.failed.push(entry)
    const cap =
      typeof entry.removeOnFail === 'number'
        ? entry.removeOnFail
        : typeof entry.removeOnFail === 'boolean'
          ? (entry.removeOnFail ? 0 : this.defaultFailedRetention)
          : (entry.removeOnFail?.count ?? this.defaultFailedRetention)
    while (this.failed.length > cap) {
      const evicted = this.failed.shift()!
      this.registry.delete(evicted.job.id)
    }
    this.onFailed?.(entry.job, error)
  }

  private hasOpenPending(): boolean {
    return this.pending.some((entry) => entry.phase === 'open')
  }

  private async drain(): Promise<void> {
    void this.pump()
    while (this.inflight.size > 0 || this.hasOpenPending()) {
      await Promise.allSettled([...this.inflight])
      void this.pump()
    }
  }
}
