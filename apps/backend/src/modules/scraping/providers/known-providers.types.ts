import type { ProviderEngine } from '../types/provider.types'

/**
 * Registro persistido de um provider (shape da tabela `providers`).
 * Espelha o modelo Prisma `Provider`, com `engine` tipado pelo domínio.
 */
export interface ProviderRecord {
  id: string
  slug: string
  name: string
  engine: ProviderEngine
  tags: string[]
  status: string
  description: string | null
  urlExample: string | null
  homepage: string | null
  searchUrl: string | null
  rateLimitMaxConcurrent: number
  rateLimitMinTime: number
  rateLimitReservoir: number | null
  rateLimitReservoirRefreshInterval: number | null
  createdAt: Date
  updatedAt: Date
}

/**
 * Dados mínimos para inserir/atualizar um provider via seed
 * (utilizado pelo `known-providers.ts` e por `upsertFromSeed`).
 */
export interface ProviderSeed {
  slug: string
  name: string
  engine: ProviderEngine
  tags?: string[]
  status?: string
  description?: string | null
  urlExample?: string | null
  homepage?: string | null
  searchUrl?: string | null
  rateLimitMaxConcurrent?: number
  rateLimitMinTime?: number
  rateLimitReservoir?: number | null
  rateLimitReservoirRefreshInterval?: number | null
}

/** Campos editáveis em uma atualização parcial de provider (slug não é alterável). */
export type ProviderUpdate = Partial<Omit<ProviderSeed, 'slug'>>
