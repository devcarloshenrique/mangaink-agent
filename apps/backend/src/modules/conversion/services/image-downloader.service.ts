import { join } from 'node:path'
import { writeFile, readdir } from 'node:fs/promises'
import { mkdirp, pathExists } from '../../../shared/utils/filesystem'
import { httpClient } from '../../../shared/http/http-client'
import { env } from '../../../shared/config/env'
import { ConversionEventsService } from './conversion-events.service'
import type { ConversionJobRepository } from '../repositories/conversion-job.repository'

export interface DownloadResult {
  chapterId: string
  totalImages: number
  downloadedImages: number
  errors: number
  fromCache: boolean
}

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

      await this.events.emit(jobId, this.events.createEvent('download.chapter.started', {
        chapterId,
        totalImages: imageFiles.length,
        fromCache: true,
      }))

      await this.events.emit(jobId, this.events.createEvent('download.chapter.finished', {
        chapterId,
        downloadedImages: imageFiles.length,
        totalImages: imageFiles.length,
        errors: 0,
        fromCache: true,
      }))

      // Log no repositório
      await this.repository.appendLog(jobId, `Capítulo ${chapterId}: cache hit (${imageFiles.length} imagens)`)

      return {
        chapterId,
        totalImages: imageFiles.length,
        downloadedImages: imageFiles.length,
        errors: 0,
        fromCache: true,
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

    // Download em paralelo com limite de concorrência
    const concurrency = 5
    const chunks: string[][] = []
    for (let i = 0; i < imageUrls.length; i += concurrency) {
      chunks.push(imageUrls.slice(i, i + concurrency))
    }

    for (const chunk of chunks) {
      const results = await Promise.allSettled(
        chunk.map(async (url, index) => {
          const ext = url.split('.').pop()?.split('?')[0] ?? 'jpg'
          const filename = `${String(downloaded + index + 1).padStart(4, '0')}.${ext}`
          const cachePath = join(cacheDir, filename)

          const response = await httpClient.get(url, {
            responseType: 'arraybuffer',
            validateStatus: (status) => status === 200,
          })

          // Valida se a resposta é realmente uma imagem
          const contentType = getContentType(response as { headers: Record<string, unknown> })
          if (!contentType.startsWith('image/')) {
            throw new Error(
              `Resposta não é uma imagem. Content-Type: "${contentType}" para URL: ${url}`,
            )
          }

          // Valida que o conteúdo não está vazio
          const data = Buffer.from(response.data)
          if (data.length === 0) {
            throw new Error(`Imagem vazia baixada para URL: ${url}`)
          }

          // Salva APENAS no cache de sources
          await writeFile(cachePath, data)

          return true
        }),
      )

      for (const result of results) {
        if (result.status === 'fulfilled') {
          downloaded++
        } else {
          errors++
          console.error(
            `[ImageDownloader] Erro ao baixar imagem do capítulo ${chapterId}:`,
            (result as PromiseRejectedResult).reason?.message ?? 'unknown error',
          )
        }
      }

      // Emite progresso após cada chunk
      await this.events.emit(jobId, this.events.createEvent('download.progress', {
        chapterId,
        downloadedImages: downloaded,
        totalImages: imageUrls.length,
        errors,
      }))

      // Atualiza estado do job
      await this.repository.update(jobId, {
        downloadedImages: downloaded,
        totalImages: imageUrls.length,
        currentStep: `Downloading chapter ${chapterId} (${downloaded}/${imageUrls.length}, ${errors} errors)`,
      })
    }

    // Se nenhuma imagem foi baixada com sucesso, falha o capítulo
    if (downloaded === 0 && imageUrls.length > 0) {
      throw new Error(
        `Falha ao baixar capítulo ${chapterId}: nenhuma imagem válida obtida (${errors} erros)`,
      )
    }

    await this.events.emit(jobId, this.events.createEvent('download.chapter.finished', {
      chapterId,
      downloadedImages: downloaded,
      totalImages: imageUrls.length,
      errors,
      fromCache: false,
    }))

    await this.repository.appendLog(jobId, `Capítulo ${chapterId}: download concluído (${downloaded}/${imageUrls.length}, ${errors} erros)`)

    return {
      chapterId,
      totalImages: imageUrls.length,
      downloadedImages: downloaded,
      errors,
      fromCache: false,
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