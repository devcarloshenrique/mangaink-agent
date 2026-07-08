import type { SourceInspectResponse } from './source.types'

/**
 * Campos de cache presentes no metadata.json.
 * Nunca são expostos pela API — apenas lidos/escritos internamente.
 */
export interface MetadataCache {
  /** ISO 8601 — quando o metadata.json foi criado pela primeira vez */
  createdAt: string
  /** ISO 8601 — última vez que o cache foi gerado ou atualizado */
  updatedAt: string
  /** ISO 8601 — última vez que o cache foi acessado (hit ou miss) */
  lastAccessAt: string
  /** Horas de validade do cache antes de expirar */
  cacheTtlHours: number
  /** Dias para retenção antes de limpeza automática (null = nunca limpar) */
  retentionDays: number | null
}

/** Estrutura completa do arquivo metadata.json em disco. */
export interface SourceMetadataFile extends SourceInspectResponse {
  cache: MetadataCache
}
