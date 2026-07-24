import { join, extname } from 'node:path'
import { writeFile, readdir } from 'node:fs/promises'
import { mkdirp, pathExists, readJson, writeJson } from '../../../shared/utils/filesystem'
import type { IProviderStrategy } from '../interfaces/provider-strategy.interface'
import type { ChapterManifest } from '../types/chapter-download.types'

const IMAGE_MAGIC_BYTES: Array<{ signature: number[]; label: string }> = [
  { signature: [0xff, 0xd8, 0xff], label: 'JPEG' },
  { signature: [0x89, 0x50, 0x4e, 0x47], label: 'PNG' },
  { signature: [0x52, 0x49, 0x46, 0x46], label: 'WEBP' },
  { signature: [0x47, 0x49, 0x46, 0x38], label: 'GIF' },
  { signature: [0x42, 0x4d], label: 'BMP' },
]

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

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.avif'])

function isImageFile(filename: string): boolean {
  const ext = extname(filename).toLowerCase()
  return IMAGE_EXTENSIONS.has(ext)
}

/**
 * Servico leve para gerenciamento de cache de imagens de capítulo.
 * Usado pelo worker de download e pelo proxy inteligente do reader.
 */
export class ChapterImageService {
  constructor(
    private readonly provider: IProviderStrategy,
    private readonly sourceId: string,
    private readonly chapterId: string,
    private readonly storagePath: string,
  ) {}

  getCacheDir(): string {
    return join(this.storagePath, 'sources', this.sourceId, 'chapters', this.chapterId)
  }

  getCachedPath(index: number): string {
    return join(this.getCacheDir(), String(index).padStart(4, '0'))
  }

  async isCached(): Promise<boolean> {
    const dir = this.getCacheDir()
    if (!(await pathExists(dir))) return false

    let entries: string[]
    try {
      entries = await readdir(dir)
    } catch {
      return false
    }

    return entries.some((f) => isImageFile(f))
  }

  /**
   * Conta quantas imagens já estão em disco no diretório de cache.
   */
  async countCachedImages(): Promise<number> {
    const dir = this.getCacheDir()
    if (!(await pathExists(dir))) return 0

    let entries: string[]
    try {
      entries = await readdir(dir)
    } catch {
      return 0
    }

    return entries.filter((f) => isImageFile(f)).length
  }

  async getImageUrls(chapterUrl: string): Promise<string[]> {
    return this.provider.getChapterImages(chapterUrl)
  }

  async downloadAll(imageUrls: string[]): Promise<{ downloaded: number; errors: number }> {
    const cacheDir = this.getCacheDir()
    await mkdirp(cacheDir)

    let downloaded = 0
    let errors = 0

    const results = await Promise.allSettled(
      imageUrls.map(async (url, i) => {
        const { buffer, contentType } = await this.provider.downloadImage(url)

        if (!isImageBuffer(buffer)) {
          throw new Error(`Magic bytes inválidos para ${url}`)
        }

        const ext = contentTypeToExt(contentType) ?? extname(new URL(url).pathname) ?? '.jpg'
        const filename = `${String(i + 1).padStart(4, '0')}${ext}`
        const filePath = join(cacheDir, filename)

        await writeFile(filePath, buffer)
      }),
    )

    for (const r of results) {
      if (r.status === 'fulfilled') {
        downloaded++
      } else {
        errors++
      }
    }

    return { downloaded, errors }
  }

  async writeManifest(manifest: ChapterManifest): Promise<void> {
    const cacheDir = this.getCacheDir()
    await mkdirp(cacheDir)
    await writeJson(join(cacheDir, 'manifest.json'), manifest)
  }

  async readManifest(): Promise<ChapterManifest | null> {
    return readJson<ChapterManifest>(join(this.getCacheDir(), 'manifest.json'))
  }
}

function contentTypeToExt(contentType: string): string | null {
  const map: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'image/bmp': '.bmp',
    'image/avif': '.avif',
  }
  return map[contentType] ?? null
}