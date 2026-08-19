import { z } from 'zod'

export const inspectSourceBodySchema = z.object({
  url: z
    .string({ error: 'A URL é obrigatória' })
    .trim()
    .min(1, 'A URL é obrigatória')
    .url('Informe uma URL válida')
    .max(2048, 'A URL deve ter no máximo 2048 caracteres'),
})

export const inspectSourceQuerySchema = z.object({
  refresh: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
})

export type InspectSourceBody = z.infer<typeof inspectSourceBodySchema>
export type InspectSourceQuery = z.infer<typeof inspectSourceQuerySchema>
