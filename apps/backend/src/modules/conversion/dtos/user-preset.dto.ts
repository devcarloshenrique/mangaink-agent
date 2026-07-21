import { z } from 'zod'

export const createUserPresetSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  description: z.string().max(500).trim().optional(),
  values: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  isDefault: z.boolean().optional().default(false),
})

export type CreateUserPresetInput = z.infer<typeof createUserPresetSchema>

export const updateUserPresetSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  description: z.string().max(500).trim().nullable().optional(),
  isDefault: z.boolean().optional(),
})

export type UpdateUserPresetInput = z.infer<typeof updateUserPresetSchema>

export const updateUserPresetValuesSchema = z.object({
  values: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
})

export type UpdateUserPresetValuesInput = z.infer<typeof updateUserPresetValuesSchema>

export const presetParamsSchema = z.object({
  presetId: z.string().min(1),
})

export type PresetParams = z.infer<typeof presetParamsSchema>

export const userPresetResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  values: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  isDefault: z.boolean(),
  lastUsedAt: z.string().nullable().optional(),
  usageCount: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type UserPresetResponse = z.infer<typeof userPresetResponseSchema>

export const userPresetListResponseSchema = z.object({
  presets: z.array(userPresetResponseSchema),
  limit: z.number().int().nonnegative(),
})

export type UserPresetListResponse = z.infer<typeof userPresetListResponseSchema>
