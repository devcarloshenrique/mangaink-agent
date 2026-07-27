import type { SourceCacheRepository } from '../repositories/source-cache.repository'
import type { MetadataCache } from '../types/metadata.types'

const DEFAULT_CACHE_TTL_HOURS = 24
const DEFAULT_RETENTION_DAYS = 30

/**
 * Serviço responsável pela lógica de cache baseada em metadata.json.
 */
export class CacheService {
  constructor(private readonly repository: SourceCacheRepository) {}

  /**
   * Verifica se o cache de uma source ainda está válido.
   * Retorna false se não existir ou se o TTL tiver expirado.
   */
  async isValid(sourceId: string): Promise<boolean> {
    const metadata = await this.repository.load(sourceId)
    if (!metadata) return false

    const { updatedAt, cacheTtlHours } = metadata.cache
    const updatedAtDate = new Date(updatedAt)
    const expiresAt = new Date(updatedAtDate.getTime() + cacheTtlHours * 60 * 60 * 1000)

    return new Date() < expiresAt
  }

  /**
   * Atualiza `updatedAt` e `lastAccessAt` quando o cache é reutilizado (hit).
   */
  async touch(sourceId: string): Promise<void> {
    const now = new Date().toISOString()
    await this.repository.update(sourceId, {
      updatedAt: now,
      lastAccessAt: now,
    })
  }

  /**
   * Estende o TTL e retenção de uma source quando o usuário baixa/converte.
   */
  async extendRetention(sourceId: string, days: number): Promise<void> {
    const now = new Date().toISOString()
    await this.repository.update(sourceId, {
      updatedAt: now,
      lastAccessAt: now,
      cacheTtlHours: days * 24,
      retentionDays: days,
    })
  }

  /**
   * Cria um objeto MetadataCache para uma nova inspeção.
   */
  createFreshCache(): MetadataCache {
    const now = new Date().toISOString()
    return {
      createdAt: now,
      updatedAt: now,
      lastAccessAt: now,
      cacheTtlHours: DEFAULT_CACHE_TTL_HOURS,
      retentionDays: DEFAULT_RETENTION_DAYS,
    }
  }
}
