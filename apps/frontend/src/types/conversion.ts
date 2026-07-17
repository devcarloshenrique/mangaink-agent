// types/conversion.ts — tipos espelhando o schema do backend (conversion.routes.ts)

export interface DeviceProfile {
  id: string;
  name: string;
  resolution: string;
}

export interface OutputFormat {
  id: string;
  name: string;
  default?: boolean;
}

export interface FieldOption {
  id: string;
  label: string;
}

export interface ConversionField {
  id: string;
  type: "boolean" | "enum" | "number";
  component: "switch" | "select" | "slider" | "input";
  label: string;
  description: string;
  help: string;
  default: string | number | boolean;
  group: "reading" | "processing" | "image" | "output" | "format";
  options?: FieldOption[];
  min?: number;
  max?: number;
  step?: number;
}

export interface ConversionPreset {
  id: string;
  name: string;
  description: string;
  values: Record<string, string | number | boolean>;
  exclusive?: boolean;
}

export interface ConversionOptions {
  devices: DeviceProfile[];
  formats: OutputFormat[];
  fields: ConversionField[];
  presets: ConversionPreset[];
}

export type CoverRef =
  | { kind: "original" }
  | { kind: "gallery"; coverId: string }
  | { kind: "upload"; uploadId: string; name: string };

export interface Book {
  title: string;
  chapters: string[]; // IDs dos capítulos
}

/** Status individual de um Job dentro de uma Conversion */
export type JobStatus =
  | "queued"
  | "preparing"
  | "downloading"
  | "converting"
  | "packaging"
  | "completed"
  | "failed"
  | "cancelled";

/** Job individual dentro de uma Conversion */
export interface JobSummary {
  jobId: string;
  index: number;
  title: string;
  status: JobStatus;
  progress: number;
  outputFile?: string;
  outputSize?: number;
  downloadUrl?: string;
  error?: string;
}

/** Status agregado de uma Conversion */
export type ConversionStatus =
  "queued" | "processing" | "completed" | "failed" | "cancelled" | "partial";

/** Estado agregado retornado pelo GET /api/conversions/:id */
export interface ConversionState {
  conversionId: string;
  status: ConversionStatus;
  progress: number;
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  runningJobs: number;
  pendingJobs: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  finishedAt?: string;
  error?: string;
  jobs: JobSummary[];
  config: unknown;
}

/** Resumo leve de uma Conversion para listagem paginada */
export interface ConversionSummary {
  conversionId: string;
  sourceId: string;
  title: string;
  status: ConversionStatus;
  progress: number;
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  createdAt: string;
  updatedAt: string;
  finishedAt?: string;
  cover?: CoverRef;
}

/** Resultado paginado GET /api/conversions */
export interface ConversionListResult {
  items: ConversionSummary[];
  total: number;
  page: number;
  limit: number;
}

/** Snapshot imutável da requisição (config) */
export interface ConversionConfig {
  sourceId: string;
  cover: CoverRef;
  output: { deviceId: string; format: string };
  metadata: { title?: string; author?: string };
  books: Book[];
  options: Record<string, string | number | boolean | undefined>;
  errorHandlingStrategy?: "ignore" | "skip_chapter" | "abort";
  userId: string;
}

/** Resposta do POST /api/conversions */
export interface CreateConversionResponse {
  conversionId: string;
  status: "queued";
  totalJobs: number;
  createdAt: string;
}

/** Body do POST /api/conversions */
export interface CreateConversionBody {
  sourceId: string;
  cover: CoverRef;
  output: { deviceId: string; format: string };
  metadata: { title: string; author: string };
  books: Book[];
  options: Record<string, string | number | boolean>;
  errorHandlingStrategy?: "ignore" | "skip_chapter" | "abort";
}

/** Tipos de eventos SSE de conversão */
export type ConversionSSEEventType =
  | "job.started"
  | "download.started"
  | "download.progress"
  | "download.chapter.started"
  | "download.chapter.done"
  | "download.finished"
  | "download.image.corrupt"
  | "conversion.started"
  | "conversion.progress"
  | "conversion.finished"
  | "job.finished"
  | "job.failed"
  | "keepalive";

/** Evento SSE persistido no journal do Redis */
export interface SSEJournalEvent {
  type: string
  data: Record<string, unknown>
  timestamp: string
  id?: number
}
