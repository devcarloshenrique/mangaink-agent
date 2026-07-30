import { z } from 'zod'

export const readingParamsSchema = z.object({
  sourceId: z.string().max(255).describe('ID da fonte'),
})

export const readingChapterParamsSchema = z.object({
  sourceId: z.string().max(255).describe('ID da fonte'),
  chapterId: z.string().max(100).describe('ID do capítulo'),
})

export const batchMarkReadBodySchema = z.object({
  chapterIds: z.array(z.string().max(100)).min(1).max(500).describe('Lista de IDs dos capítulos'),
  markAsRead: z.boolean().describe('true para marcar como lido, false para desmarcar'),
})

export const markReadResponseSchema = z.object({
  isRead: z.literal(true),
})

export const unmarkReadResponseSchema = z.object({
  isRead: z.literal(false),
})

export const readingProgressResponseSchema = z.object({
  sourceId: z.string(),
  readChapterIds: z.array(z.string()),
  totalRead: z.number(),
  totalChapters: z.number(),
  lastReadAt: z.string().nullable(),
})

export const batchMarkReadResponseSchema = z.object({
  updatedCount: z.number(),
  readChapterIds: z.array(z.string()),
})

export type ReadingParams = z.infer<typeof readingParamsSchema>
export type ReadingChapterParams = z.infer<typeof readingChapterParamsSchema>
export type BatchMarkReadBody = z.infer<typeof batchMarkReadBodySchema>
