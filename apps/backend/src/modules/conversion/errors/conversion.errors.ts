export class ConversionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message)
    this.name = 'ConversionError'
  }
}

export class ConversionNotFoundError extends ConversionError {
  constructor(conversionId: string) {
    super(`Conversion não encontrada: ${conversionId}`, 'CONVERSION_NOT_FOUND')
    this.name = 'ConversionNotFoundError'
  }
}

export class SourceNotFoundError extends ConversionError {
  constructor(sourceId: string) {
    super(`Source não encontrada: ${sourceId}`, 'SOURCE_NOT_FOUND')
    this.name = 'SourceNotFoundError'
  }
}

export class InvalidConversionStateError extends ConversionError {
  constructor(conversionId: string, currentStatus: string, expectedStatus: string) {
    super(
      `Conversion ${conversionId} está com status "${currentStatus}", esperado "${expectedStatus}"`,
      'INVALID_CONVERSION_STATE',
    )
    this.name = 'InvalidConversionStateError'
  }
}

export class JobNotFoundError extends ConversionError {
  constructor(jobId: string) {
    super(`Job de conversão não encontrado: ${jobId}`, 'JOB_NOT_FOUND')
    this.name = 'JobNotFoundError'
  }
}

export class InvalidJobStateError extends ConversionError {
  constructor(jobId: string, currentStatus: string, expectedStatus: string) {
    super(
      `Job ${jobId} está com status "${currentStatus}", esperado "${expectedStatus}"`,
      'INVALID_JOB_STATE',
    )
    this.name = 'InvalidJobStateError'
  }
}

export class ValidationError extends ConversionError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR')
    this.name = 'ValidationError'
  }
}

export class DuplicateChapterError extends ConversionError {
  constructor(chapterId: string) {
    super(`Capítulo duplicado entre os books: ${chapterId}`, 'DUPLICATE_CHAPTER')
    this.name = 'DuplicateChapterError'
  }
}

export class ChapterNotFoundError extends ConversionError {
  constructor(chapterId: string, sourceId: string) {
    super(
      `Capítulo ${chapterId} não encontrado na source ${sourceId}`,
      'CHAPTER_NOT_FOUND',
    )
    this.name = 'ChapterNotFoundError'
  }
}

export class KccExecutionError extends ConversionError {
  constructor(jobId: string, exitCode: number | null, stderr: string, _cause?: unknown) {
    super(
      `KCC falhou para job ${jobId}: código ${exitCode}, stderr: ${stderr.slice(0, 500)}`,
      'KCC_EXECUTION_ERROR',
    )
    this.name = 'KccExecutionError'
  }
}

export class DownloadFailedError extends ConversionError {
  declare cause?: unknown

  constructor(jobId: string, chapterId: string, imageUrl: string, cause?: unknown) {
    super(
      `Falha ao baixar imagem para job ${jobId}, capítulo ${chapterId}: ${imageUrl}`,
      'DOWNLOAD_FAILED',
    )
    this.name = 'DownloadFailedError'
    this.cause = cause
  }
}

export class ForbiddenError extends ConversionError {
  constructor(conversionId: string) {
    super(`Acesso negado à conversão: ${conversionId}`, 'FORBIDDEN')
    this.name = 'ForbiddenError'
  }
}