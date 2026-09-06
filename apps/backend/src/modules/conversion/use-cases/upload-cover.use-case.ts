import { join, extname } from 'node:path'
import { writeFile, unlink } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { mkdirp } from '../../../shared/utils/filesystem'
import { env } from '../../../shared/config/env'
import { assertValidImage, detectImageContentType } from '../../../shared/utils/image-validation'
import { getPrisma } from '../../../shared/database/prisma'
import { getSourceRepository } from '../../../shared/database/repositories'
import { ValidationError, SourceNotFoundError } from '../errors/conversion.errors'
import type { UploadCoverBody, UploadCoverResponse } from '../dtos/upload-cover.dto'
const MAX_FILE_SIZE = 15 * 1024 * 1024 // 15MB

const EXT_MAP: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
}

export class UploadCoverUseCase {
  async execute(data: UploadCoverBody, userId?: string): Promise<UploadCoverResponse> {
    // 0. Se sourceId fornecido, valida existência da source
    if (data.sourceId) {
      const source = await getSourceRepository().load(data.sourceId)
      if (!source) {
        throw new SourceNotFoundError(data.sourceId)
      }
    }

    // 1. Decodifica base64 (suporta data URL "data:image/...;base64,..." ou base64 raw)
    let rawBase64 = data.base64Data
    const commaIndex = rawBase64.indexOf(',')
    if (commaIndex !== -1 && rawBase64.slice(0, commaIndex).includes(';base64')) {
      rawBase64 = rawBase64.slice(commaIndex + 1)
    }

    const buffer = Buffer.from(rawBase64, 'base64')

    // 2. Limite de tamanho (15MB)
    if (buffer.length > MAX_FILE_SIZE) {
      throw new ValidationError(`Tamanho da capa excede o limite de 15MB (tamanho: ${buffer.length} bytes)`)
    }

    // 3. Validação de magic bytes (assertValidImage lança InvalidImageContentError se inválido)
    assertValidImage(buffer)

    // 4. Detecta content type real a partir dos bytes
    const detectedType = detectImageContentType(buffer)
    const ext = EXT_MAP[detectedType] ?? EXT_MAP[data.contentType] ?? (extname(data.fileName).toLowerCase() || '.jpg')

    // 5. Gera ID e persiste no disco (uploads/covers)
    const uploadId = `up_${randomUUID()}`
    const uploadsDir = join(env.STORAGE_PATH, 'uploads', 'covers')
    await mkdirp(uploadsDir)

    const filePath = join(uploadsDir, `${uploadId}${ext}`)
    await writeFile(filePath, buffer)

    // 6. Se sourceId presente, vincula no banco e salva em storage/sources/{sourceId}/covers/{uploadId}.ext
    if (data.sourceId) {
      const sourceCoversDir = join(env.STORAGE_PATH, 'sources', data.sourceId, 'covers')
      await mkdirp(sourceCoversDir)
      const sourceCoverPath = join(sourceCoversDir, `${uploadId}${ext}`)
      await writeFile(sourceCoverPath, buffer)

      const label = data.label?.trim() || data.fileName

      try {
        await getPrisma().cover.create({
          data: {
            coverId: uploadId,
            sourceId: data.sourceId,
            type: 'upload',
            label,
            imageUrl: `/api/conversions/covers/uploaded/${uploadId}`,
            ...(userId ? { userId } : {}),
          },
        })
      } catch (err) {
        // Compensação: o banco recusou — apaga os arquivos já escritos
        // (ordem inversa) para não deixar capa órfã no disco.
        try {
          await unlink(sourceCoverPath)
        } catch {}
        try {
          await unlink(filePath)
        } catch {}
        throw err
      }

      return {
        uploadId,
        name: data.fileName,
        url: `/api/conversions/covers/uploaded/${uploadId}`,
        sourceId: data.sourceId,
        coverId: uploadId,
      }
    }

    return {
      uploadId,
      name: data.fileName,
      url: `/api/conversions/covers/uploaded/${uploadId}`,
    }
  }
}
