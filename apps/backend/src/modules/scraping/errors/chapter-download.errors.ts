export class ChapterNotFoundError extends Error {
  public readonly code = 'CHAPTER_NOT_FOUND'
  constructor(sourceId: string, chapterId: string) {
    super(`Capítulo ${chapterId} não encontrado na source ${sourceId}`)
    this.name = 'ChapterNotFoundError'
  }
}

export class PageNotFoundError extends Error {
  public readonly code = 'PAGE_NOT_FOUND'
  constructor(sourceId: string, chapterId: string, index: number) {
    super(`Página ${index} não encontrada para o capítulo ${chapterId} (source: ${sourceId})`)
    this.name = 'PageNotFoundError'
  }
}

export class InvalidPageIndexError extends Error {
  public readonly code = 'INVALID_PAGE_INDEX'
  constructor(index: number, total: number) {
    super(`Índice de página inválido: ${index}. O intervalo válido é 1-${total}`)
    this.name = 'InvalidPageIndexError'
  }
}

export class ChapterDownloadFailedError extends Error {
  public readonly code = 'CHAPTER_DOWNLOAD_FAILED'
  constructor(sourceId: string, chapterId: string, reason?: string) {
    super(`Falha ao baixar capítulo ${chapterId} (source: ${sourceId})${reason ? `: ${reason}` : ''}`)
    this.name = 'ChapterDownloadFailedError'
  }
}

/**
 * Erro usado pelo proxy inteligente quando a imagem solicitada ainda não está
 * em cache e o download via provider falhou (URL expirada, timeout, etc.).
 * O frontend faz retry a cada 500ms até receber a imagem do cache.
 */
export class PageNotReadyError extends Error {
  public readonly code = 'PAGE_NOT_READY'
  public readonly readyCount: number
  public readonly totalCount: number

  constructor(sourceId: string, chapterId: string, index: number, readyCount: number, totalCount: number) {
    super(`Página ${index} do capítulo ${chapterId} ainda não está pronta (${readyCount}/${totalCount} disponíveis)`)
    this.name = 'PageNotReadyError'
    this.readyCount = readyCount
    this.totalCount = totalCount
  }
}
