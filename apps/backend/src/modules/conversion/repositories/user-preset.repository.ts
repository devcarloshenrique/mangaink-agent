import type { UserPreset } from '../types/conversion.types'

export interface CreateUserPresetData {
  userId: string
  name: string
  description?: string | null
  values: Record<string, string | number | boolean>
  isDefault?: boolean
}

export interface UpdateUserPresetData {
  name?: string
  description?: string | null
  isDefault?: boolean
}

export interface IUserPresetRepository {
  findAllByUserId(userId: string): Promise<UserPreset[]>
  findById(presetId: string, userId: string): Promise<UserPreset | null>
  create(data: CreateUserPresetData): Promise<UserPreset>
  updateMeta(presetId: string, userId: string, data: UpdateUserPresetData): Promise<UserPreset>
  updateValues(presetId: string, userId: string, values: Record<string, string | number | boolean>): Promise<UserPreset>
  delete(presetId: string, userId: string): Promise<void>
  toggleDefault(presetId: string, userId: string): Promise<void>
  incrementUsage(presetId: string): Promise<void>
  touchLastUsed(presetId: string): Promise<void>
}
