import { join, extname } from 'node:path'
import { readdir } from 'node:fs/promises'
import { pathExists } from '../../../shared/utils/filesystem'
import { env } from '../../../shared/config/env'
import { ConversionNotFoundError } from '../errors/conversion.errors'

const MIME_MAP: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
}

export class GetUploadedCoverUseCase {
  async execute(uploadId: string): Promise<{ filePath: string; contentType: string }> {
    const uploadsDir = join(env.STORAGE_PATH, 'uploads', 'covers')

    // 1. Tenta encontrar arquivo direto caso já venha com extensão ou testando extensões comuns
    for (const ext of ['.jpg', '.jpeg', '.png', '.webp', '']) {
      const candidatePath = join(uploadsDir, `${uploadId}${ext}`)
      if (await pathExists(candidatePath)) {
        const fileExt = extname(candidatePath).toLowerCase()
        return {
          filePath: candidatePath,
          contentType: MIME_MAP[fileExt] ?? 'image/jpeg',
        }
      }
    }

    // 2. Se não encontrou diretamente, busca na pasta por prefixo
    if (await pathExists(uploadsDir)) {
      try {
        const files = await readdir(uploadsDir)
        const matched = files.find(
          (f) => f === uploadId || f.startsWith(`${uploadId}.`) || f.startsWith(uploadId),
        )
        if (matched) {
          const filePath = join(uploadsDir, matched)
          const fileExt = extname(matched).toLowerCase()
          return {
            filePath,
            contentType: MIME_MAP[fileExt] ?? 'image/jpeg',
          }
        }
      } catch {
        // ignora erro de readdir e cai na exceção
      }
    }

    throw new ConversionNotFoundError(`Capa enviada "${uploadId}" não encontrada`)
  }
}
