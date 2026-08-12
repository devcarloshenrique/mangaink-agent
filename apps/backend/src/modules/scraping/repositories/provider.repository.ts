import type { ProviderRecord, ProviderSeed, ProviderUpdate } from '../providers/known-providers.types'

/**
 * Interface/Porta do repositório de providers.
 * O use-case depende desta abstração, não da implementação concreta.
 *
 * Implementação: PrismaProviderRepository.
 */
export interface ProviderRepository {
  /** Lista todos os providers cadastrados. */
  findAll(): Promise<ProviderRecord[]>

  /** Busca um provider pelo slug. Retorna null se não existir. */
  findBySlug(slug: string): Promise<ProviderRecord | null>

  /** Insere ou atualiza (upsert por slug) os providers de um seed. */
  upsertFromSeed(seeds: ProviderSeed[]): Promise<void>

  /** Atualiza campos parciais de um provider. Retorna null se não existir. */
  update(slug: string, data: ProviderUpdate): Promise<ProviderRecord | null>
}
