import { z } from 'zod'

export const sourceParamsSchema = z.object({
  sourceId: z.string().min(1),
})

export type SourceParams = z.infer<typeof sourceParamsSchema>
