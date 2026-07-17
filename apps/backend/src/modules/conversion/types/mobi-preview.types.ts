/**
 * Tipos do módulo de preview de MOBI no navegador.
 *
 * O preview extrai as paginas (imagens) de um arquivo MOBI gerado pelo KCC,
 * preservando a ordem de leitura (spine) do MOBI original. As paginas sao
 * armazenadas em /temp/ ao lado do .mobi, com TTL de 24h (configuravel).
 *
 * Fluxo:
 *   1. POST /preview         → enfileira extracao no BullMQ (idempotente)
 *      - 200 { status:'ready' } se cache valido (TTL nao expirou)
 *      - 202 { status:'processing' } se job enfileirado
 *   2. Worker  mobi-preview  → docker run mangaink-unpack → /temp/images + index.json
 *   3. GET  /preview         → status agregado (readyPages, totalPages, cacheUntil)
 *   4. GET  /preview/pages/:index → serve a pagina como stream (Cache-Control 24h)
 */

/** Status do preview no Redis Hash (live, TTL curto). */
export type MobiPreviewLiveStatus = 'queued' | 'extracting' | 'ready' | 'failed'

export interface MobiPreviewLiveState {
  status: MobiPreviewLiveStatus
  totalPages: number
  readyPages: number
  currentStep: string
  error?: string
  updatedAt: string
  completedAt?: string
}

/** Estrutura do `index.json` em `/temp/<file-base>/`. */
export interface MobiPreviewIndex {
  /** Basename do arquivo MOBI de origem (ex: "Boruto - Vol. 01.mobi"). */
  sourceMobi: string
  /** ISO 8601 do momento de extracao. */
  extractedAt: string
  /** Paginas na ordem do spine do MOBI. */
  pages: MobiPreviewPage[]
}

export interface MobiPreviewPage {
  /** Indice zero-based da pagina (preservado do MOBI). */
  index: number
  /** Nome do arquivo em `images/` (ex: "00000.jpg"). */
  filename: string
  /** MIME type (ex: "image/jpeg"). */
  contentType: string
}

/** Resposta agregada do endpoint GET /preview. */
export interface MobiPreviewStatusResponse {
  status: MobiPreviewLiveStatus
  totalPages: number
  readyPages: number
  /** ISO 8601 — quando expira o cache /temp. */
  cacheUntil: string | null
  error?: string
}

/** Resposta do POST /preview. */
export interface MobiPreviewStartResponse {
  status: 'ready' | 'processing'
  totalPages?: number
  cached: boolean
}