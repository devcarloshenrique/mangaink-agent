import { z } from 'zod'

export const deleteCoverParamsSchema = z.object({
  coverId: z.string().trim().min(1, 'coverId é obrigatório'),
})

export const deleteCoverResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
})

export type DeleteCoverParams = z.infer<typeof deleteCoverParamsSchema>
export type DeleteCoverResponse = z.infer<typeof deleteCoverResponseSchema>
