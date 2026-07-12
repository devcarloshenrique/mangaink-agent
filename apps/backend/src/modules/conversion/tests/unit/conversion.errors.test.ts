import { describe, it, expect } from 'vitest'
import {
  ConversionError,
  ConversionNotFoundError,
  SourceNotFoundError,
  InvalidConversionStateError,
  JobNotFoundError,
  InvalidJobStateError,
  ValidationError,
  DuplicateChapterError,
  ChapterNotFoundError,
  KccExecutionError,
  DownloadFailedError,
  ForbiddenError,
} from '../../errors/conversion.errors'

describe('Conversion Errors', () => {
  it('ConversionError base deve ter name e code', () => {
    const err = new ConversionError('erro base', 'TEST_CODE')
    expect(err.name).toBe('ConversionError')
    expect(err.message).toBe('erro base')
    expect(err.code).toBe('TEST_CODE')
  })

  it('ConversionNotFoundError', () => {
    const err = new ConversionNotFoundError('conv_123')
    expect(err.name).toBe('ConversionNotFoundError')
    expect(err.code).toBe('CONVERSION_NOT_FOUND')
    expect(err.message).toContain('conv_123')
  })

  it('SourceNotFoundError', () => {
    const err = new SourceNotFoundError('src_123')
    expect(err.name).toBe('SourceNotFoundError')
    expect(err.code).toBe('SOURCE_NOT_FOUND')
    expect(err.message).toContain('src_123')
  })

  it('InvalidConversionStateError', () => {
    const err = new InvalidConversionStateError('conv_123', 'completed', 'queued')
    expect(err.name).toBe('InvalidConversionStateError')
    expect(err.code).toBe('INVALID_CONVERSION_STATE')
    expect(err.message).toContain('status "completed"')
  })

  it('JobNotFoundError', () => {
    const err = new JobNotFoundError('job_123')
    expect(err.name).toBe('JobNotFoundError')
    expect(err.code).toBe('JOB_NOT_FOUND')
    expect(err.message).toContain('job_123')
  })

  it('InvalidJobStateError', () => {
    const err = new InvalidJobStateError('job_123', 'completed', 'download')
    expect(err.name).toBe('InvalidJobStateError')
    expect(err.code).toBe('INVALID_JOB_STATE')
  })

  it('ValidationError', () => {
    const err = new ValidationError('campo inválido')
    expect(err.name).toBe('ValidationError')
    expect(err.code).toBe('VALIDATION_ERROR')
  })

  it('DuplicateChapterError', () => {
    const err = new DuplicateChapterError('chap_0001')
    expect(err.name).toBe('DuplicateChapterError')
    expect(err.code).toBe('DUPLICATE_CHAPTER')
    expect(err.message).toContain('chap_0001')
  })

  it('ChapterNotFoundError', () => {
    const err = new ChapterNotFoundError('chap_9999', 'src_123')
    expect(err.name).toBe('ChapterNotFoundError')
    expect(err.code).toBe('CHAPTER_NOT_FOUND')
    expect(err.message).toContain('chap_9999')
    expect(err.message).toContain('src_123')
  })

  it('KccExecutionError', () => {
    const err = new KccExecutionError('job_123', 1, 'stderr output')
    expect(err.name).toBe('KccExecutionError')
    expect(err.code).toBe('KCC_EXECUTION_ERROR')
  })

  it('DownloadFailedError', () => {
    const err = new DownloadFailedError('job_123', 'chap_0001', 'http://img.url')
    expect(err.name).toBe('DownloadFailedError')
    expect(err.code).toBe('DOWNLOAD_FAILED')
  })

  it('ForbiddenError', () => {
    const err = new ForbiddenError('conv_123')
    expect(err.name).toBe('ForbiddenError')
    expect(err.code).toBe('FORBIDDEN')
    expect(err.message).toContain('conv_123')
  })

  it('ForbiddenError deve estender ConversionError', () => {
    expect(new ForbiddenError('x')).toBeInstanceOf(ConversionError)
  })

  it('todos os erros devem estender ConversionError', () => {
    expect(new ConversionNotFoundError('x')).toBeInstanceOf(ConversionError)
    expect(new SourceNotFoundError('x')).toBeInstanceOf(ConversionError)
    expect(new ValidationError('x')).toBeInstanceOf(ConversionError)
    expect(new KccExecutionError('x', 1, 'x')).toBeInstanceOf(ConversionError)
    expect(new ForbiddenError('x')).toBeInstanceOf(ConversionError)
  })
})
