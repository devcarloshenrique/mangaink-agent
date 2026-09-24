import { z } from 'zod'

export const MAX_EXPLICIT_PROVIDERS = 20

export const searchSourcesQuerySchema = z.object({
  q: z.string().trim().min(2, 'Informe ao menos 2 caracteres').max(100),
  providers: z
    .string()
    .optional()
    .transform((csv) =>
      csv
        ?.split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0),
    )
    .pipe(
      z
        .array(z.string())
        .max(MAX_EXPLICIT_PROVIDERS, `Máximo de ${MAX_EXPLICIT_PROVIDERS} providers`)
        .optional(),
    ),
  limit: z.coerce.number().int().min(1).max(20).default(10),
  offset: z.coerce.number().int().min(0).max(100).default(0),
  language: z.string().trim().toLowerCase().max(20).optional(),
})

export type SearchSourcesQuery = z.infer<typeof searchSourcesQuerySchema>

export const providerSearchResultSchema = z.object({
  providerSlug: z.string(),
  title: z.string(),
  url: z.string(),
  coverUrl: z.string().nullable().optional(),
  author: z.string().nullable().optional(),
  type: z.string().nullable().optional(),
  genres: z.array(z.string()).nullable().optional(),
})

export const searchSourcesResponseSchema = z.object({
  query: z.string(),
  results: z.array(providerSearchResultSchema),
  errors: z.array(z.object({ providerSlug: z.string(), message: z.string() })),
  searchedProviders: z.array(z.string()),
  truncated: z.boolean(),
})

export type SearchSourcesResponse = z.infer<typeof searchSourcesResponseSchema>
