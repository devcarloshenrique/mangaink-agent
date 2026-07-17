import { join } from 'node:path'
import { stat, readdir, rm } from 'node:fs/promises'
import { env } from '../../../shared/config/env'
import { pathExists, readJson } from '../../../shared/utils/filesystem'
import type { MobiPreviewIndex } from '../types/mobi-preview.types'
import {
  InvalidPageIndexError,
  MobiFileNotFoundError,
  PreviewNotReadyError,
} from '../errors/mobi-preview.errors'

export interface MobiPreviewPaths {
  /** Caminho absoluto do arquivo .mobi de saida. */
  mobiPath: string
  /** Diretorio /temp/<file-base>/ ao lado do MOBI (cache de preview). */
  tempDir: string
  /** /temp/<file-base>/images/. */
  imagesDir: string
  /** /temp/<file-base>/index.json. */
  indexPath: string
  /** /temp/<file-base>/READY (sinal atomico de extracao concluida). */
  readyPath: string
}

/**
 * Servico de resolucao de paths, controle de TTL (24h default) e leitura do
 * `index.json` produzido pelo container `mangaink-unpack`.
 *
 * O cache de preview vive ao lado do MOBI de saida do Job:
 *   <CONVERSIONS_STORAGE_PATH>/<conversionId>/jobs/<jobId>/output/
 *     ├─ <file>.mobi
 *     └─ temp/<file-base>/
 *          ├─ images/NNNNN.<ext>
 *          ├─ index.json
 *          └─ READY
 *
 * O TTL e por <file-base>: comeca a contar do mtime do `index.json`. Se
 * expirado ou ausente, o cache e considerado invalido e o use-case enfileira
 * uma nova extracao.
 */
export class MobiPreviewService {
  /** Resolve todos os paths associados ao preview de um MOBI de saida. */
  resolvePaths(conversionId: string, jobId: string, outputFile: string): MobiPreviewPaths {
    const jobOutputDir = join(env.CONVERSIONS_STORAGE_PATH, conversionId, 'jobs', jobId, 'output')
    const mobiPath = join(jobOutputDir, outputFile)
    const base = outputFile.replace(/\.[^.]+$/, '')
    const tempDir = join(jobOutputDir, 'temp', base)
    return {
      mobiPath,
      tempDir,
      imagesDir: join(tempDir, 'images'),
      indexPath: join(tempDir, 'index.json'),
      readyPath: join(tempDir, 'READY'),
    }
  }

  /** Verifica se o cache /temp e valido (index.json existe e mtime < TTL). */
  async isCacheValid(
    conversionId: string,
    jobId: string,
    outputFile: string,
  ): Promise<boolean> {
    const { indexPath } = this.resolvePaths(conversionId, jobId, outputFile)
    if (!(await pathExists(indexPath))) return false
    try {
      const stats = await stat(indexPath)
      const ageMs = Date.now() - stats.mtimeMs
      return ageMs < env.MOBI_PREVIEW_TTL_SEC * 1000
    } catch {
      return false
    }
  }

  /** Le e parseia o `index.json`. Retorna `null` se inexistente. */
  async readIndex(
    conversionId: string,
    jobId: string,
    outputFile: string,
  ): Promise<MobiPreviewIndex | null> {
    const { indexPath } = this.resolvePaths(conversionId, jobId, outputFile)
    return readJson<MobiPreviewIndex>(indexPath)
  }

  /** Conta quantas imagens ja existem em images/ (extracao em curso ou completa). */
  async countReadyPages(
    conversionId: string,
    jobId: string,
    outputFile: string,
  ): Promise<number> {
    const { imagesDir } = this.resolvePaths(conversionId, jobId, outputFile)
    if (!(await pathExists(imagesDir))) return 0
    try {
      const entries = await readdir(imagesDir)
      return entries.filter((f) => /\.(jpg|jpeg|png|gif|bmp|webp|avif)$/i.test(f)).length
    } catch {
      return 0
    }
  }

  /** Resolves a single page file. Throws if index missing, page out of range, or page not yet written. */
  async resolvePageFile(
    conversionId: string,
    jobId: string,
    outputFile: string,
    pageIndex: number,
  ): Promise<{ filePath: string; contentType: string }> {
    const { imagesDir } = this.resolvePaths(conversionId, jobId, outputFile)
    const index = await this.readIndex(conversionId, jobId, outputFile)
    if (!index) {
      throw new PreviewNotReadyError(jobId, 0, 0)
    }
    if (pageIndex < 0 || pageIndex >= index.pages.length) {
      throw new InvalidPageIndexError(jobId, pageIndex, index.pages.length)
    }
    const page = index.pages[pageIndex]
    const filePath = join(imagesDir, page.filename)
    if (!(await pathExists(filePath))) {
      throw new PreviewNotReadyError(jobId, pageIndex, index.pages.length)
    }
    return { filePath, contentType: page.contentType }
  }

  /** ISO 8601 do momento em que o cache atual expira (mtime + TTL). */
  async cacheUntil(
    conversionId: string,
    jobId: string,
    outputFile: string,
  ): Promise<string | null> {
    const { indexPath } = this.resolvePaths(conversionId, jobId, outputFile)
    if (!(await pathExists(indexPath))) return null
    try {
      const stats = await stat(indexPath)
      return new Date(stats.mtimeMs + env.MOBI_PREVIEW_TTL_SEC * 1000).toISOString()
    } catch {
      return null
    }
  }

  /** Garante que o .mobi existe no disco; lanca erro de dominio caso contrario. */
  async requireMobiFile(
    conversionId: string,
    jobId: string,
    outputFile: string,
  ): Promise<string> {
    const { mobiPath } = this.resolvePaths(conversionId, jobId, outputFile)
    if (!(await pathExists(mobiPath))) {
      throw new MobiFileNotFoundError(jobId)
    }
    return mobiPath
  }

  /** Remove o diretorio temp/<file-base> (usado antes de re-extrair). */
  async clearTemp(
    conversionId: string,
    jobId: string,
    outputFile: string,
  ): Promise<void> {
    const { tempDir } = this.resolvePaths(conversionId, jobId, outputFile)
    await rm(tempDir, { recursive: true, force: true })
  }
}