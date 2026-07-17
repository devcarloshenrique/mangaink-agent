import { ConversionError } from './conversion.errors'

/** MOBI de entrada nao encontrado no disco (arquivo sumiu apos a conversao). */
export class MobiFileNotFoundError extends ConversionError {
  constructor(jobId: string) {
    super(`Arquivo MOBI de saída não encontrado no disco para job ${jobId}`, 'JOB_NOT_FOUND')
    this.name = 'MobiFileNotFoundError'
  }
}

/** Preview ainda nao esta pronto — extracao em curso. */
export class PreviewNotReadyError extends ConversionError {
  constructor(jobId: string, readyPages: number, totalPages: number) {
    super(
      `Preview do job ${jobId} ainda não está pronto — ${readyPages}/${totalPages} página(s) extraída(s)`,
      'PREVIEW_NOT_READY',
    )
    this.name = 'PreviewNotReadyError'
  }
}

/** Indice de pagina solicitado fora do intervalo valido do index.json. */
export class InvalidPageIndexError extends ConversionError {
  constructor(jobId: string, index: number, totalPages: number) {
    super(
      `Índice de página inválido para job ${jobId}: ${index} (intervalo válido: 0..${totalPages - 1})`,
      'VALIDATION_ERROR',
    )
    this.name = 'InvalidPageIndexError'
  }
}

/**
 * O arquivo de saida do job nao e MOBI — preview so se aplica a MOBI.
 * Retornado quando o endpoint de preview e chamado para um job EPUB/CBZ/PDF.
 */
export class NotAMobiJobError extends ConversionError {
  constructor(jobId: string, actualFormat: string) {
    super(
      `Job ${jobId} não é MOBI (formato=${actualFormat}). Preview só se aplica a MOBI.`,
      'VALIDATION_ERROR',
    )
    this.name = 'NotAMobiJobError'
  }
}

/** Extracao falhou (Docker unavailable, MOBI corrompido, etc). */
export class MobiExtractionError extends ConversionError {
  declare cause?: unknown

  constructor(jobId: string, stderr: string, cause?: unknown) {
    super(
      `Extração do MOBI falhou para job ${jobId}: ${stderr.slice(0, 500)}`,
      'KCC_EXECUTION_ERROR',
    )
    this.name = 'MobiExtractionError'
    this.cause = cause
  }
}