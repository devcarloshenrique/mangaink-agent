import type {
  ConversionConfig,
  ConversionState,
  ConversionStatusFile,
  Book,
  CoverRef,
} from '../../types/conversion.types'

export function makeCover(kind: 'original' | 'gallery' = 'original'): CoverRef {
  if (kind === 'gallery') return { kind: 'gallery', coverId: 'cover_001' }
  return { kind: 'original' }
}

export function makeBook(overrides: Partial<Book> = {}): Book {
  return {
    title: 'Volume 01',
    chapters: ['chap_0001', 'chap_0002'],
    ...overrides,
  }
}

export function makeConversionConfig(overrides: Partial<ConversionConfig> = {}): ConversionConfig {
  return {
    sourceId: 'src-hunter-x-hunter-cb3c9071',
    cover: makeCover(),
    output: { deviceId: 'K11', format: 'EPUB' },
    metadata: { title: 'Hunter x Hunter', author: 'Yoshihiro Togashi' },
    books: [makeBook()],
    options: { mangaMode: true, splitter: 'split' },
    ...overrides,
  }
}

export function makeSourceMetadata(chapters: string[] = ['chap_0001', 'chap_0002']): {
  chapters: Array<{ id: string }>
} {
  return {
    chapters: chapters.map((id) => ({ id })),
  }
}
