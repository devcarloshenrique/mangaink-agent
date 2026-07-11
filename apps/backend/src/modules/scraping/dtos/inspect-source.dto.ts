import { z } from 'zod'

export const inspectSourceBodySchema = z.object({
  url: z
    .string({ error: 'A URL é obrigatória' })
    .url('Informe uma URL válida')
    .min(1),
})

export const inspectSourceQuerySchema = z.object({
  refresh: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
})

export type InspectSourceBody = z.infer<typeof inspectSourceBodySchema>
export type InspectSourceQuery = z.infer<typeof inspectSourceQuerySchema>
