import { z } from 'zod'

export const conversionParamsSchema = z.object({
  conversionId: z.string().min(1, 'conversionId é obrigatório'),
})

export type ConversionParams = z.infer<typeof conversionParamsSchema>