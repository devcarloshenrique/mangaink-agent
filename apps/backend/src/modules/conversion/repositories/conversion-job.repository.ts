import type { ConversionJobConfig, ConversionJobStatus, ConversionJobState } from '../types/conversion.types'

export interface ConversionJobRepository {
  /**
   * Cria um job completo: escreve config.json + status.json + cria diretórios (logs/, temp/, output/).
   */
  create(job: ConversionJobState): Promise<void>

  /**
   * Retorna a visão unificada (config + status) do job.
   */
  findById(jobId: string): Promise<ConversionJobState | null>

  /**
   * Atualiza apenas o status.json (estado mutável).
   * O config.json NUNCA é alterado após criação.
   */
  update(jobId: string, updates: Partial<ConversionJobStatus>): Promise<void>

  /**
   * Remove o diretório inteiro do job.
   */
  delete(jobId: string): Promise<void>

  /**
   * Adiciona uma linha de log ao arquivo logs/conversion.log.
   */
  appendLog(jobId: string, message: string): Promise<void>

}