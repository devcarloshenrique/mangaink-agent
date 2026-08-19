import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { env } from '../../../shared/config/env'
import { pathExists } from '../../../shared/utils/filesystem'
import { logger } from '../../../shared/logging/logger'

/**
 * Serviço de acesso ao storage de conversões (`CONVERSIONS_STORAGE_PATH`).
 *
 * Layout de um diretório de conversão:
 *   <CONVERSIONS_STORAGE_PATH>/<conversionId>/
 *     ├─ config.json + status.json
 *     ├─ logs/conversion.log
 *     └─ jobs/<jobId>/
 *         ├─ temp/…           imagens intermediárias do KCC
 *         └─ output/…         arquivos finais (EPUB/MOBI/CBZ/PDF)
 *             └─ temp/<file-base>/   cache de preview MOBI no navegador
 *
 * A remoção recursiva do diretório da conversão cobre também os previews
 * temporários (`output/temp/<file-base>/`), que vivem DENTRO do diretório.
 */
export class ConversionStorageService {
  /** Caminho absoluto do diretório de storage de uma conversão. */
  conversionDir(conversionId: string): string {
    return join(env.CONVERSIONS_STORAGE_PATH, conversionId)
  }

  /**
   * Remove recursivamente o diretório de storage da conversão (outputs + logs +
   * previews temporários). Best-effort: nunca lança — retorna `false` e registra
   * o erro no console quando a remoção falha, para o chamador decidir o fallback.
   */
  async removeConversion(conversionId: string): Promise<boolean> {
    const dir = this.conversionDir(conversionId)
    try {
      if (!(await pathExists(dir))) return true
      await rm(dir, { recursive: true, force: true })
      return true
    } catch (err) {
      logger.error(
        { conversionId, err: err instanceof Error ? err.message : String(err) },
        '[ConversionStorage] Falha ao remover o diretório de storage da conversão',
      )
      return false
    }
  }
}
