/**
 * Dados do job de download de capítulo (payload da fila BullMQ).
 */
export interface ChapterDownloadData {
  sourceId: string
  chapterId: string
}

/**
 * Status do download de um capítulo.
 * - queued: job enfileirado, ainda não iniciado
 * - downloading: worker está baixando as imagens
 * - ready: download concluído, imagens em cache
 * - failed: download falhou
 */
export type ChapterDownloadStatus = 'queued' | 'downloading' | 'ready' | 'failed'

/**
 * Manifesto de cache do capítulo: mapeia URLs externas para índices locais.
 * Escrito no diretório de cache como manifest.json pelo worker de download
 * e pelo ImageDownloaderService (apenas no cache miss path).
 */
export interface ChapterManifest {
  totalImages: number
  urls: string[]
}
