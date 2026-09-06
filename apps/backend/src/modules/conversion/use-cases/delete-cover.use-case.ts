import { join } from 'node:path'
import { readdir, unlink } from 'node:fs/promises'
import { env } from '../../../shared/config/env'
import { pathExists } from '../../../shared/utils/filesystem'
import { getPrisma } from '../../../shared/database/prisma'
import {
  ConversionNotFoundError,
  InvalidConversionStateError,
} from '../errors/conversion.errors'
import type { DeleteCoverResponse } from '../dtos/delete-cover.dto'

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

export class DeleteCoverUseCase {
  async execute(coverId: string, userId: string): Promise<DeleteCoverResponse> {
    const prisma = getPrisma()

    // 1. Busca registro no Prisma pelo coverId ou id (somente se for uuid válido)
    const orConditions: Array<{ coverId: string } | { id: string }> = [{ coverId }]
    if (UUID_REGEX.test(coverId)) {
      orConditions.push({ id: coverId })
    }

    const cover = await prisma.cover.findFirst({
      where: {
        OR: orConditions,
      },
    })

    // 1b. Ownership: capa com dono só pode ser excluída por ele (404 para
    // não vazar existência). Linhas legadas (userId NULL) seguem globais.
    if (cover && cover.userId != null && cover.userId !== userId) {
      throw new ConversionNotFoundError('Capa não encontrada.')
    }

    // 2. Se o registro existe no banco, valida tipo
    if (cover) {
      if (cover.type !== 'upload') {
        throw new InvalidConversionStateError(
          'Apenas capas personalizadas (upload) podem ser excluídas.',
        )
      }
    }

    // 3. Verifica e remove arquivos físicos
    // Target IDs a verificar: coverId original e, se encontrado no banco, o cover.coverId / cover.id
    const targetIds = Array.from(
      new Set([coverId, cover?.coverId, cover?.id].filter(Boolean) as string[]),
    )

    let filesDeleted = 0

    // a) Diretório de uploads/covers
    const uploadsDir = join(env.STORAGE_PATH, 'uploads', 'covers')
    if (await pathExists(uploadsDir)) {
      try {
        const files = await readdir(uploadsDir)
        for (const targetId of targetIds) {
          const matchedFiles = files.filter(
            (f) =>
              f === targetId ||
              f.startsWith(`${targetId}.`) ||
              f.replace(/\.[^/.]+$/, '') === targetId,
          )
          for (const file of matchedFiles) {
            await unlink(join(uploadsDir, file))
            filesDeleted++
          }
        }
      } catch {
        // ignora erro de leitura
      }
    }

    // b) Diretório da source se sourceId associado
    const sourceId = cover?.sourceId
    if (sourceId) {
      const sourceCoversDir = join(env.STORAGE_PATH, 'sources', sourceId, 'covers')
      if (await pathExists(sourceCoversDir)) {
        try {
          const files = await readdir(sourceCoversDir)
          for (const targetId of targetIds) {
            const matchedFiles = files.filter(
              (f) =>
                f === targetId ||
                f.startsWith(`${targetId}.`) ||
                f.replace(/\.[^/.]+$/, '') === targetId,
            )
            for (const file of matchedFiles) {
              await unlink(join(sourceCoversDir, file))
              filesDeleted++
            }
          }
        } catch {
          // ignora erro de leitura
        }
      }
    }

    // 4. Se não existe no banco e nenhum arquivo foi encontrado no disco -> 404
    if (!cover && filesDeleted === 0) {
      throw new ConversionNotFoundError('Capa não encontrada.')
    }

    // 5. Deleta registro do banco se existente
    if (cover) {
      await prisma.cover.deleteMany({
        where: {
          OR: [
            { coverId: cover.coverId },
            { id: cover.id },
          ],
        },
      })
    }

    return {
      success: true,
      message: 'Capa excluída com sucesso.',
    }
  }
}
