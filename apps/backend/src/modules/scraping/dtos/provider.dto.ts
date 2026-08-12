import { z } from 'zod'
import type { ProviderRecord } from '../providers/known-providers.types'
import type { KnownProvider } from '../providers/known-providers'

export const providerStatusSchema = z.enum(['active', 'slow', 'beta', 'offline', 'soon'])

export const providerResponseSchema = z.object({
  slug: z.string(),
  name: z.string(),
  engine: z.enum(['api', 'cheerio', 'playwright']),
  tags: z.array(z.string()),
  status: z.string(),
  description: z.string().nullable(),
  urlExample: z.string().nullable(),
  homepage: z.string().nullable(),
  searchUrl: z.string().nullable(),
  rateLimit: z.object({
    maxConcurrent: z.number(),
    minTime: z.number(),
    reservoir: z.number().nullable(),
    reservoirRefreshInterval: z.number().nullable(),
  }),
})

export type ProviderResponse = z.infer<typeof providerResponseSchema>

export const listProvidersResponseSchema = z.object({
  providers: z.array(providerResponseSchema),
})

export type ListProvidersResponse = z.infer<typeof listProvidersResponseSchema>

export const providerParamsSchema = z.object({
  slug: z.string().min(1),
})

export type ProviderParams = z.infer<typeof providerParamsSchema>

export const updateProviderBodySchema = z.object({
  status: providerStatusSchema.optional(),
  description: z.string().optional(),
  urlExample: z.string().optional(),
  homepage: z.string().optional(),
  tags: z.array(z.string()).optional(),
  searchUrl: z.string().optional(),
  rateLimit: z
    .object({
      maxConcurrent: z.number().int().min(1).optional(),
      minTime: z.number().int().min(0).optional(),
      reservoir: z.number().int().min(1).nullable().optional(),
      reservoirRefreshInterval: z.number().int().min(100).nullable().optional(),
    })
    .optional(),
})

export type UpdateProviderBody = z.infer<typeof updateProviderBodySchema>

/**
 * Mapeia um provider (registro do banco ou seed estático) para o shape
 * público da API. `allowedDomains` é propositalmente omitido (SSRF protection
 * é interna — nunca exposta).
 */
export function toProviderResponse(provider: ProviderRecord | KnownProvider): ProviderResponse {
  return {
    slug: provider.slug,
    name: provider.name,
    engine: provider.engine,
    tags: provider.tags ?? [],
    status: provider.status ?? 'active',
    description: provider.description ?? null,
    urlExample: provider.urlExample ?? null,
    homepage: provider.homepage ?? null,
    searchUrl: provider.searchUrl ?? null,
    rateLimit: {
      maxConcurrent: provider.rateLimitMaxConcurrent ?? 6,
      minTime: provider.rateLimitMinTime ?? 50,
      reservoir: provider.rateLimitReservoir ?? null,
      reservoirRefreshInterval: provider.rateLimitReservoirRefreshInterval ?? null,
    },
  }
}
