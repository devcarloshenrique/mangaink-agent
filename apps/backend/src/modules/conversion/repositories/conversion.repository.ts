import type { ConversionConfig, ConversionStatusFile, ConversionState } from '../types/conversion.types'

export interface ConversionRepository {
  /** Cria a Conversion + diretórios (logs/, jobs/). */
  create(state: ConversionState): Promise<void>

  /** Retorna config + status agregado da Conversion. */
  findById(conversionId: string): Promise<ConversionState | null>

  /** Atualiza apenas status.json. config.json nunca é alterado. */
  update(conversionId: string, updates: Partial<ConversionStatusFile>): Promise<void>

  /**
   * Recomputa o status agregado da Conversion lendo todos os status.json
   * dos Jobs em disco, atualiza o status.json da Conversion e retorna o
   * estado completo. Deve ser chamado sempre que um Job alterar de estado.
   */
  syncStatus(conversionId: string): Promise<ConversionState | null>

  /** Lista os jobIds em disco. */
  listJobIds(conversionId: string): Promise<string[]>

  /** Adiciona linha ao log agregado da Conversion. */
  appendLog(conversionId: string, message: string): Promise<void>

  /** Remove todo o diretório da Conversion. */
  delete(conversionId: string): Promise<void>
}

export type { ConversionConfig, ConversionStatusFile, ConversionState }