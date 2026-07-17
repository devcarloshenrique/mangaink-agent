import { z } from 'zod'

export const coverParamsSchema = z.object({
  sourceId: z.string().min(1),
  coverId: z.string().min(1),
})

export type CoverParams = z.infer<typeof coverParamsSchema>
