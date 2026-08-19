import { z } from 'zod'

export const coverSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('original') }),
  z.object({ kind: z.literal('gallery'), coverId: z.string().trim().min(1).max(200) }),
  z.object({
    kind: z.literal('upload'),
    uploadId: z.string().trim().min(1).max(255),
    name: z.string().trim().min(1).max(255),
  }),
])

const bookSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'title do book é obrigatório')
    .max(500, 'title do book deve ter no máximo 500 caracteres'),
  chapters: z
    .array(z.string().trim().min(1).max(100, 'capítulo deve ter no máximo 100 caracteres'))
    .min(1, 'Cada book deve conter pelo menos um capítulo'),
  cover: coverSchema.optional(),
})

/**
 * Schema da requisição POST /api/conversions.
 *
 * O contrato representa a intenção do usuário — quais livros ele deseja —
 * NUNCA conceitos internos do KCC como batchSplit ou fileFusion.
 */
export const createConversionBodySchema = z
  .object({
    sourceId: z.string().min(1, 'sourceId é obrigatório'),
    downloadOnly: z.boolean().optional().default(false),
    cover: coverSchema,
    output: z
      .object({
        deviceId: z.string().min(1, 'deviceId é obrigatório'),
        format: z.string().min(1, 'format é obrigatório'),
      })
      .optional(),
    metadata: z
      .object({
        title: z.string().trim().max(500, 'title deve ter no máximo 500 caracteres').optional(),
        author: z.string().trim().max(2000, 'author deve ter no máximo 2000 caracteres').optional(),
      })
      .optional()
      .default({}),
    books: z.array(bookSchema).min(1, 'Pelo menos um book é obrigatório'),
    options: z
      .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
      .optional()
      .default({}),
    errorHandlingStrategy: z.enum(['ignore', 'skip_chapter', 'abort']).optional().default('ignore'),
  })
  .refine(
    (data) => {
      if (data.downloadOnly) return true
      return !!data.output
    },
    { message: 'output é obrigatório para conversões normais', path: ['output'] },
  )

export type CreateConversionBody = z.infer<typeof createConversionBodySchema>

export const createConversionResponseSchema = z.object({
  conversionId: z.string(),
  status: z.literal('queued'),
  totalJobs: z.number(),
  createdAt: z.string(),
})

export type CreateConversionResponse = z.infer<typeof createConversionResponseSchema>
