import { join } from 'node:path'
import { writeFile, readdir } from 'node:fs/promises'
import { mkdirp, pathExists, writeJson, readJson } from '../../../shared/utils/filesystem'
import { httpClient } from '../../../shared/http/http-client'
import { env } from '../../../shared/config/env'
import { ConversionEventsService } from './conversion-events.service'
import type { ConversionJobRepository } from '../repositories/conversion-job.repository'

export interface CorruptPage {
  pageIndex: number
  url: string
  reason: string
}

export interface DownloadResult {
  chapterId: string
  totalImages: number
  downloadedImages: number
  errors: number
  fromCache: boolean
  /** true quando nenhuma imagem pôde ser obtida (capítulo indisponível no site) */
  skipped?: boolean
  /** Páginas corrompidas detectadas (não salvas no disco) */
  corruptPages: CorruptPage[]
}

export interface ChapterImagesMeta {
  placeholderPageIndices: number[]
}

const IMAGES_META_FILENAME = 'images.json'

const IMAGE_MAGIC_BYTES: Array<{ signature: number[]; label: string }> = [
  { signature: [0xff, 0xd8, 0xff], label: 'JPEG' },
  { signature: [0x89, 0x50, 0x4e, 0x47], label: 'PNG' },
  { signature: [0x52, 0x49, 0x46, 0x46], label: 'WEBP' },
  { signature: [0x47, 0x49, 0x46, 0x38], label: 'GIF' },
  { signature: [0x42, 0x4d], label: 'BMP' },
]

/**
 * Extrai o Content-Type como string, tratando o tipo complexo do Axios.
 */
function getContentType(response: { headers: Record<string, unknown> }): string {
  const ct = response.headers['content-type']
  if (typeof ct === 'string') return ct
  if (Array.isArray(ct)) return ct[0] ?? ''
  return ''
}

/**
 * Verifica se um buffer contém bytes mágicos de um formato de imagem conhecido.
 * Previne salvar HTML, 0-byte, ou outros dados corrompidos como imagem.
 */
function isImageBuffer(buf: Buffer): boolean {
  if (buf.length === 0) return false

  for (const { signature, label } of IMAGE_MAGIC_BYTES) {
    if (label === 'WEBP') {
      if (
        buf[0] === signature[0] && buf[1] === signature[1] &&
        buf[2] === signature[2] && buf[3] === signature[3] &&
        buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
      ) {
        return true
      }
      continue
    }
    let match = true
    for (let i = 0; i < signature.length; i++) {
      if (buf[i] !== signature[i]) { match = false; break }
    }
    if (match) return true
  }

  return false
}

/**
 * Detecta se o conteúdo parece ser HTML (começa com <!DOCTYPE, <html, ou whitespace + <).
 */
function looksLikeHtml(buf: Buffer): boolean {
  const start = buf.toString('utf-8', 0, Math.min(256, buf.length)).trimStart()
  return start.startsWith('<!') || start.startsWith('<html') || start.startsWith('<HTML')
}

export async function readChapterImagesMeta(cacheDir: string): Promise<ChapterImagesMeta | null> {
  const metaPath = join(cacheDir, IMAGES_META_FILENAME)
  const exists = await pathExists(metaPath)
  if (!exists) return null
  try {
    return await readJson<ChapterImagesMeta>(metaPath)
  } catch {
    return null
  }
}

export async function writeChapterImagesMeta(cacheDir: string, meta: ChapterImagesMeta): Promise<void> {
  const metaPath = join(cacheDir, IMAGES_META_FILENAME)
  await writeJson(metaPath, meta)
}

/**
 * Serviço de download de imagens com cache em sources/.
 *
 * Responsabilidade única: garantir que as imagens de um capítulo existam
 * no cache persistente em `storage/sources/{sourceId}/chapters/{chapterId}/`.
 *
 * NÃO copia para o diretório do job — o worker fará isso via hard links.
 */
export class ImageDownloaderService {
  constructor(
    private readonly events: ConversionEventsService,
    private readonly repository: ConversionJobRepository,
  ) {}

  /**
   * Garante que as imagens de um capítulo existam no cache de sources.
   *
   * Se o cache já existe e é válido, retorna imediatamente (cache hit).
   * Se não existe, faz o download e popula o cache.
   *
   * @param jobId - ID do job (para eventos e progresso)
   * @param sourceId - ID da source (para path do cache)
   * @param chapterId - ID do capítulo
   * @param imageUrls - URLs das imagens do capítulo
   * @returns Resultado do download (ou cache hit)
   */
  async downloadChapter(
    jobId: string,
    sourceId: string,
    chapterId: string,
    imageUrls: string[],
  ): Promise<DownloadResult> {
    const cacheDir = join(env.STORAGE_PATH, 'sources', sourceId, 'chapters', chapterId)

    // ── Verifica cache ────────────────────────────────────────────
    const cacheExists = await this.isCacheValid(cacheDir, imageUrls.length)

    if (cacheExists) {
      console.log(`[ImageDownloader] Cache hit para capítulo ${chapterId}`)
      const cachedFiles = await readdir(cacheDir)
      const imageFiles = cachedFiles.filter((f) => /\.(jpg|jpeg|png|webp|gif|bmp|avif)$/i.test(f))

      const meta = await readChapterImagesMeta(cacheDir)
      const corruptPages: CorruptPage[] = []

      if (meta && meta.placeholderPageIndices.length > 0) {
        for (const idx of meta.placeholderPageIndices) {
          const cp: CorruptPage = {
            pageIndex: idx,
            url: '(cache)',
            reason: 'Página placeholder (substituída em conversão anterior)',
          }
          corruptPages.push(cp)
          await this.events.emit(jobId, this.events.createEvent('download.image.corrupt', {
            chapterId,
            pageIndex: idx,
            url: '(cache)',
            reason: 'Página placeholder (substituída anteriormente)',
          }))
        }
        await this.repository.appendLog(jobId,
          `Capítulo ${chapterId}: cache hit — ${imageFiles.length} imagens, ${meta.placeholderPageIndices.length} placeholders (${meta.placeholderPageIndices.map(i => `p${i}`).join(', ')})`)
      } else {
        await this.repository.appendLog(jobId,
          `Capítulo ${chapterId}: cache hit (${imageFiles.length} imagens)`)
      }

      await this.events.emit(jobId, this.events.createEvent('download.chapter.started', {
        chapterId,
        totalImages: imageFiles.length,
        fromCache: true,
      }))

      await this.events.emit(jobId, this.events.createEvent('download.chapter.finished', {
        chapterId,
        downloadedImages: imageFiles.length,
        totalImages: imageFiles.length,
        errors: corruptPages.length,
        fromCache: true,
      }))

      return {
        chapterId,
        totalImages: imageFiles.length,
        downloadedImages: imageFiles.length,
        errors: corruptPages.length,
        fromCache: true,
        corruptPages,
      }
    }

    // ── Download para o cache em sources/ ─────────────────────────
    await mkdirp(cacheDir)

    await this.events.emit(jobId, this.events.createEvent('download.chapter.started', {
      chapterId,
      totalImages: imageUrls.length,
      fromCache: false,
    }))

    await this.repository.appendLog(jobId, `Capítulo ${chapterId}: iniciando download de ${imageUrls.length} imagens`)

    let downloaded = 0
    let errors = 0
    const corruptPages: CorruptPage[] = []

    const concurrency = 5
    const chunks: string[][] = []
    for (let i = 0; i < imageUrls.length; i += concurrency) {
      chunks.push(imageUrls.slice(i, i + concurrency))
    }

    for (const chunk of chunks) {
      const results = await Promise.allSettled(
        chunk.map(async (url, index) => {
          const globalIndex = downloaded + errors + corruptPages.length + index + 1
          const ext = url.split('.').pop()?.split('?')[0] ?? 'jpg'
          const filename = `${String(globalIndex).padStart(4, '0')}.${ext}`
          const cachePath = join(cacheDir, filename)

          const response = await httpClient.get(url, {
            responseType: 'arraybuffer',
            validateStatus: (status) => status === 200,
          })

          const data = Buffer.from(response.data)
          const contentType = getContentType(response as { headers: Record<string, unknown> })

          if (!isImageBuffer(data)) {
            const reason = looksLikeHtml(data)
              ? `Resposta HTML em vez de imagem (Content-Type: "${contentType}")`
              : data.length === 0
                ? 'Imagem vazia (0 bytes)'
                : `Magic bytes inválidos (Content-Type: "${contentType}", tamanho: ${data.length})`
            throw { corrupt: true, pageIndex: globalIndex, url, reason }
          }

          if (!contentType.startsWith('image/')) {
            throw {
              corrupt: true,
              pageIndex: globalIndex,
              url,
              reason: `Content-Type inesperado: "${contentType}" (imagem válida mas tipo suspeito)`,
            }
          }

          await writeFile(cachePath, data)
          return true
        }),
      )

      for (const result of results) {
        if (result.status === 'fulfilled') {
          downloaded++
        } else {
          const reason = (result as PromiseRejectedResult).reason
          if (reason && typeof reason === 'object' && (reason as { corrupt?: boolean }).corrupt) {
            const cp: CorruptPage = {
              pageIndex: (reason as CorruptPage).pageIndex,
              url: (reason as CorruptPage).url,
              reason: (reason as CorruptPage).reason,
            }
            corruptPages.push(cp)

            await this.events.emit(jobId, this.events.createEvent('download.image.corrupt', {
              chapterId,
              pageIndex: cp.pageIndex,
              url: cp.url,
              reason: cp.reason,
            }))
          } else {
            errors++
            console.error(
              `[ImageDownloader] Erro ao baixar imagem do capítulo ${chapterId}:`,
              reason?.message ?? 'unknown error',
            )
          }
        }
      }

      await this.events.emit(jobId, this.events.createEvent('download.progress', {
        chapterId,
        downloadedImages: downloaded,
        totalImages: imageUrls.length,
        errors: errors + corruptPages.length,
      }))

      await this.repository.update(jobId, {
        downloadedImages: downloaded,
        totalImages: imageUrls.length,
        currentStep: `Downloading chapter ${chapterId} (${downloaded}/${imageUrls.length}, ${errors + corruptPages.length} errors)`,
      })
    }

    if (downloaded === 0 && imageUrls.length > 0) {
      const isAllCorrupt = corruptPages.length === imageUrls.length
      const reason = isAllCorrupt ? 'all_corrupt' : 'no_images_available'
      await this.repository.appendLog(
        jobId,
        isAllCorrupt
          ? `AVISO: capítulo ${chapterId} pulado — todas as ${corruptPages.length} páginas estão corrompidas (${corruptPages.map(c => `p${c.pageIndex}`).join(', ')})`
          : `AVISO: capítulo ${chapterId} pulado — nenhuma imagem disponível (${errors} erros 404). O capítulo pode estar temporariamente indisponível no site de origem.`,
      )
      await this.events.emit(
        jobId,
        this.events.createEvent('download.chapter.skipped', {
          chapterId,
          totalImages: imageUrls.length,
          errors: errors + corruptPages.length,
          reason,
        }),
      )
      return {
        chapterId,
        totalImages: imageUrls.length,
        downloadedImages: 0,
        errors,
        fromCache: false,
        skipped: true,
        corruptPages,
      }
    }

    await this.events.emit(jobId, this.events.createEvent('download.chapter.finished', {
      chapterId,
      downloadedImages: downloaded,
      totalImages: imageUrls.length,
      errors: errors + corruptPages.length,
      fromCache: false,
    }))

    await this.repository.appendLog(jobId, `Capítulo ${chapterId}: download concluído (${downloaded}/${imageUrls.length}, ${errors + corruptPages.length} erros${corruptPages.length > 0 ? `, ${corruptPages.length} corrompidas` : ''})`)

    return {
      chapterId,
      totalImages: imageUrls.length,
      downloadedImages: downloaded,
      errors: errors + corruptPages.length,
      fromCache: false,
      corruptPages,
    }
  }

  /**
   * Verifica se o cache do capítulo é válido.
   */
  private async isCacheValid(cacheDir: string, expectedCount: number): Promise<boolean> {
    const exists = await pathExists(cacheDir)
    if (!exists) return false

    try {
      const files = await readdir(cacheDir)
      const imageFiles = files.filter((f) => /\.(jpg|jpeg|png|webp|gif|bmp|avif)$/i.test(f))
      return imageFiles.length > 0 && (expectedCount === 0 || imageFiles.length >= expectedCount)
    } catch {
      return false
    }
  }
}