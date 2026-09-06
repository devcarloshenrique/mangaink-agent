import { z } from 'zod'

export const libraryItemSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  sourceId: z.string(),
  title: z.string(),
  author: z.string().nullable(),
  coverUrl: z.string().nullable(),
  chaptersCount: z.number().int().nonnegative(),
  isFavorite: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type LibraryItemDTO = z.infer<typeof libraryItemSchema>

export const listLibraryQuerySchema = z.object({
  isFavorite: z.coerce.boolean().optional(),
  query: z.string().optional(),
})

export type ListLibraryQuery = z.infer<typeof listLibraryQuerySchema>

export const listLibraryResponseSchema = z.object({
  items: z.array(libraryItemSchema),
  total: z.number().int().nonnegative(),
})

export type ListLibraryResponse = z.infer<typeof listLibraryResponseSchema>

export const addToLibraryBodySchema = z.object({
  sourceId: z.string().min(1, 'sourceId é obrigatório'),
})

export type AddToLibraryBody = z.infer<typeof addToLibraryBodySchema>

export const libraryParamsSchema = z.object({
  sourceId: z.string().min(1, 'sourceId é obrigatório'),
})

export type LibraryParams = z.infer<typeof libraryParamsSchema>

export const toggleFavoriteBodySchema = z.object({
  isFavorite: z.boolean().optional(),
})

export type ToggleFavoriteBody = z.infer<typeof toggleFavoriteBodySchema>

export const userLibrarySchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  sourceId: z.string(),
  isFavorite: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type UserLibraryDTO = z.infer<typeof userLibrarySchema>

export const removeFromLibraryResponseSchema = z.object({
  success: z.literal(true),
})

export type RemoveFromLibraryResponse = z.infer<typeof removeFromLibraryResponseSchema>
