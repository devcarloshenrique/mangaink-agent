// ─────────────────────────────────────────────────────────────────────────
// Tipos públicos de Conversion (intenção do usuário)
// ─────────────────────────────────────────────────────────────────────────

/** Status agregado de uma Conversion (computado a partir dos Jobs). */
export type ConversionStatus =
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'partial'

/** Referência a uma capa. Herdável: Book sem capa própria usa a capa global. */
export type CoverRef =
  | { kind: 'original' }
  | { kind: 'gallery'; coverId: string }
  | { kind: 'upload'; uploadId: string; name: string }

/** Configuração de saída aplicada a todos os Books da Conversion. */
export interface ConversionOutput {
  deviceId: string
  format: string
}

/** Metadados da obra compartilhados por todos os Books (API pública). */
export interface ConversionMetadata {
  title?: string
  author?: string
}

/** Metadados internos do Job — title é sempre definido (vem do Book). */
export interface JobMetadata {
  title: string
  author?: string
}

/**
 * Book: um livro final desejado pelo usuário.
 * Backend produz exatamente 1 Job (1 EPUB) por Book.
 */
export interface Book {
  title: string
  chapters: string[]
  /** Capa específica deste Book; se omitido, herda a capa global. */
  cover?: CoverRef
}

/** Snapshot imutável da requisição do usuário, salvo em config.json. */
export type ErrorHandlingStrategy = 'ignore' | 'skip_chapter' | 'abort'

export interface ConversionConfig {
  sourceId: string
  cover: CoverRef
  output: ConversionOutput
  metadata: ConversionMetadata
  books: Book[]
  /** Opções KCC aceitas pela API pública (sem batchSplit/fileFusion). */
  options: Record<string, string | number | boolean | undefined>
  /** Estratégia para lidar com páginas corrompidas durante o download. */
  errorHandlingStrategy?: ErrorHandlingStrategy
  /** ID do usuário dono da conversão. */
  userId: string
}

/** Resumo do estado de um Job dentro de uma Conversion. */
export interface ConversionJobSummary {
  jobId: string
  index: number
  title: string
  status: JobStatus
  progress: number
  outputFile?: string
  outputSize?: number
  downloadUrl?: string
  error?: string
}

/** Estado mutável agregado salvo em status.json da Conversion. */
export interface ConversionStatusFile {
  conversionId: string
  status: ConversionStatus
  progress: number
  totalJobs: number
  completedJobs: number
  failedJobs: number
  runningJobs: number
  pendingJobs: number
  createdAt: string
  updatedAt: string
  completedAt?: string
  finishedAt?: string
  error?: string
  jobs: ConversionJobSummary[]
}

/** Visão unificada (config + status) retornada pela API. */
export interface ConversionState extends ConversionStatusFile {
  config: ConversionConfig
}

/**
 * Resumo leve de uma Conversion para listagem paginada.
 * Não inclui snapshot pesado (books/options/chapters/jobs) —
 * usar `GET /api/conversions/:id` para detalhe.
 */
export interface ConversionSummary {
  conversionId: string
  sourceId: string
  title: string
  status: ConversionStatus
  progress: number
  totalJobs: number
  completedJobs: number
  failedJobs: number
  createdAt: string
  updatedAt: string
  finishedAt?: string
  cover?: CoverRef
}

/** Filtros opcionais para listagem de Conversions por usuário. */
export interface ConversionListFilters {
  status?: ConversionStatus[]
  sourceId?: string
}

/** Paginação para listagem de Conversions. */
export interface ConversionListPagination {
  page: number
  limit: number
}

/** Resultado paginado de listagem de Conversions. */
export interface ConversionListResult {
  items: ConversionSummary[]
  total: number
  page: number
  limit: number
}

// ─────────────────────────────────────────────────────────────────────────
// Tipos internos de Conversion Job (uma execução do KCC)
// ─────────────────────────────────────────────────────────────────────────

export type JobStatus =
  | 'queued'
  | 'preparing'
  | 'downloading'
  | 'converting'
  | 'packaging'
  | 'completed'
  | 'failed'
  | 'cancelled'

export type SSEEventType =
  | 'conversion.created'
  | 'conversion.progress'
  | 'conversion.completed'
  | 'conversion.failed'
  | 'conversion.cancelled'
  | 'job.created'
  | 'job.started'
  | 'download.started'
  | 'download.chapter.started'
  | 'download.chapter.finished'
  | 'download.chapter.skipped'
  | 'download.progress'
  | 'download.image.corrupt'
  | 'conversion.started'
  | 'conversion.progress'
  | 'conversion.finished'
  | 'job.finished'
  | 'job.failed'

export interface SSEEvent {
  type: SSEEventType
  data: Record<string, unknown>
  timestamp: string
  id?: number
}

export interface DeviceProfile {
  id: string
  name: string
  resolution: string
}

export interface OutputFormat {
  id: string
  name: string
  default?: boolean
}

export interface FieldOption {
  id: string
  label: string
}

export interface ConversionField {
  id: string
  type: 'boolean' | 'enum' | 'number'
  component: 'switch' | 'select' | 'slider' | 'input'
  label: string
  description: string
  help: string
  default: string | number | boolean
  group: 'reading' | 'processing' | 'image' | 'output' | 'format'
  options?: FieldOption[]
  min?: number
  max?: number
  step?: number
}

export interface ConversionPreset {
  id: string
  name: string
  description: string
  values: Record<string, string | number | boolean>
  exclusive?: boolean
}

export interface ConversionOptions {
  devices: DeviceProfile[]
  formats: OutputFormat[]
  fields: ConversionField[]
  presets: ConversionPreset[]
}

/**
 * Snapshot imutável do Job (uma execução do KCC).
 * Salvo em {conversionDir}/jobs/{jobId}/config.json.
 *
 * OBS: `options` pode conter chaves internas definidas pelo Planner
 * (batchSplit, fileFusion) que NÃO são expostas pela API pública.
 */
export interface ConversionJobConfig {
  conversionId: string
  jobId: string
  bookIndex: number
  sourceId: string
  chapters: string[]
  cover: CoverRef
  output: ConversionOutput
  metadata: JobMetadata
  options: Record<string, string | number | boolean | undefined>
  errorHandlingStrategy?: ErrorHandlingStrategy
}

/**
 * Estado mutável do Job, salvo em status.json.
 */
export interface ConversionJobStatus {
  jobId: string
  status: JobStatus
  progress: number
  currentStep: string
  downloadedImages: number
  totalImages: number
  createdAt: string
  updatedAt: string
  completedAt?: string
  downloadUrl?: string
  outputFile?: string
  outputSize?: number
  error?: string
}

/** Visão unificada do Job: config + status. */
export interface ConversionJobState extends ConversionJobStatus {
  config: ConversionJobConfig
}

/** Dados enviados ao BullMQ para processamento de um Job. */
export interface ConversionJobData {
  conversionId: string
  jobId: string
  bookIndex: number
  sourceId: string
  chapters: string[]
  cover: CoverRef
  output: ConversionOutput
  metadata: JobMetadata
  options: Record<string, string | number | boolean | undefined>
  storagePath: string
  errorHandlingStrategy?: ErrorHandlingStrategy
}