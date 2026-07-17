import { z } from 'zod'

export const mobiPreviewParamsSchema = z.object({
  conversionId: z.string().min(1),
  jobId: z.string().min(1),
})

export type MobiPreviewParams = z.infer<typeof mobiPreviewParamsSchema>

export const mobiPreviewPageParamsSchema = mobiPreviewParamsSchema.extend({
  index: z.coerce.number().int().nonnegative(),
})

export type MobiPreviewPageParams = z.infer<typeof mobiPreviewPageParamsSchema>

// ── Schemas de resposta (Swagger) ──────────────────────────────────────────
export const mobiPreviewStartResponseSchema = z.object({
  status: z.enum(['ready', 'processing']),
  totalPages: z.number().int().nonnegative().optional(),
  cached: z.boolean(),
})

export const mobiPreviewStatusResponseSchema = z.object({
  status: z.enum(['queued', 'extracting', 'ready', 'failed']),
  totalPages: z.number().int().nonnegative(),
  readyPages: z.number().int().nonnegative(),
  cacheUntil: z.string().nullable(),
  error: z.string().optional(),
})