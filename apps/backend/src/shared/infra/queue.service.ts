/**
 * Contratos de fila desacoplados da infraestrutura (BullMQ/Redis).
 * Implementações concretas: BullMQ (modo web) e embedded (desktop).
 */

/** Representa um job enfileirado e visível para o produtor da fila. */
export interface QueueJob<T = unknown> {
  id: string
  name: string
  data: T
  attemptsMade: number
}

/** Opções de agendamento aceitas ao enfileirar um job. */
export interface QueueAddOptions {
  jobId?: string
  attempts?: number
  backoff?: { type: 'exponential'; delay: number }
  removeOnComplete?: { count: number }
  removeOnFail?: { count: number }
}

/** Opções de concorrência para a factory de worker. */
export interface QueueConcurrencyOptions {
  concurrency?: number
}

/**
 * Produtor de filas — enfileira, consulta e remove jobs.
 * É a fronteira entre os módulos de domínio e a fila real (BullMQ ou embedded).
 */
export interface IQueueService<T = unknown> {
  add(name: string, data: T, opts?: QueueAddOptions): Promise<QueueJob<T>>
  getJob(jobId: string): Promise<QueueJob<T> | null>
  removeJob(jobId: string): Promise<void>
}
