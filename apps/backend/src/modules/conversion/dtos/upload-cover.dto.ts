import { z } from 'zod'

export const uploadCoverBodySchema = z.object({
  sourceId: z.string().trim().min(1).optional(),
  label: z.string().trim().min(1).max(100).optional(),
  fileName: z.string().trim().min(1).max(255),
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  // 15 MiB em base64 (15*1024*1024*4/3) + folga p/ prefixo data-URL; o
  // use-case revalida os bytes decodificados (400) — este é o teto barato.
  base64Data: z.string().min(1).max(20971584),
})

export const uploadCoverResponseSchema = z.object({
  uploadId: z.string(),
  name: z.string(),
  url: z.string(),
  sourceId: z.string().optional(),
  coverId: z.string().optional(),
})

export const uploadedCoverParamsSchema = z.object({
  uploadId: z.string().trim().min(1),
})

export type UploadCoverBody = z.infer<typeof uploadCoverBodySchema>
export type UploadCoverResponse = z.infer<typeof uploadCoverResponseSchema>
export type UploadedCoverParams = z.infer<typeof uploadedCoverParamsSchema>
