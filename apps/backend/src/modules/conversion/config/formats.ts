import type { OutputFormat } from '../types/conversion.types'

export const formats: OutputFormat[] = [
  { id: 'EPUB', name: 'EPUB', default: true },
  { id: 'MOBI', name: 'MOBI' },
  { id: 'CBZ', name: 'CBZ' },
  { id: 'PDF', name: 'PDF' },
  { id: 'KFX', name: 'KFX' },
  { id: 'MOBI+EPUB', name: 'MOBI + EPUB' },
]