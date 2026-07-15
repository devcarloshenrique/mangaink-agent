import { z } from 'zod'
import type { ConversionStatus } from '../types/conversion.types'

export const listConversionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z
    .enum(['queued', 'processing', 'completed', 'failed', 'cancelled', 'partial'])
    .optional(),
  sourceId: z.string().min(1).optional(),
})

export type ListConversionsQuery = z.infer<typeof listConversionsQuerySchema>

export const listConversionsStatusValues: ConversionStatus[] = [
  'queued',
  'processing',
  'completed',
  'failed',
  'cancelled',
  'partial',
]