import { z } from 'zod'

export const coverSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('original') }),
  z.object({ kind: z.literal('gallery'), coverId: z.string().min(1) }),
  z.object({ kind: z.literal('upload'), uploadId: z.string().min(1), name: z.string().min(1) }),
])

const bookSchema = z.object({
  title: z.string().min(1, 'title do book é obrigatório'),
  chapters: z.array(z.string().min(1)).min(1, 'Cada book deve conter pelo menos um capítulo'),
  cover: coverSchema.optional(),
})

/**
 * Schema da requisição POST /api/conversions.
 *
 * O contrato representa a intenção do usuário — quais livros ele deseja —
 * NUNCA conceitos internos do KCC como batchSplit ou fileFusion.
 */
export const createConversionBodySchema = z.object({
  sourceId: z.string().min(1, 'sourceId é obrigatório'),
  cover: coverSchema,
  output: z.object({
    deviceId: z.string().min(1, 'deviceId é obrigatório'),
    format: z.string().min(1, 'format é obrigatório'),
  }),
  metadata: z.object({
    title: z.string().optional(),
    author: z.string().optional(),
  }).optional().default({}),
  books: z.array(bookSchema).min(1, 'Pelo menos um book é obrigatório'),
  options: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
    .optional()
    .default({}),
  errorHandlingStrategy: z
    .enum(['ignore', 'skip_chapter', 'abort'])
    .optional()
    .default('ignore'),
})

export type CreateConversionBody = z.infer<typeof createConversionBodySchema>

export const createConversionResponseSchema = z.object({
  conversionId: z.string(),
  status: z.literal('queued'),
  totalJobs: z.number(),
  createdAt: z.string(),
})

export type CreateConversionResponse = z.infer<typeof createConversionResponseSchema>