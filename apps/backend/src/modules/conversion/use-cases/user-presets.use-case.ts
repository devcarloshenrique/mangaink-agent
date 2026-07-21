import { env } from '../../../shared/config/env'
import {
  UserPresetNotFoundError,
  DuplicatePresetNameError,
  PresetLimitReachedError,
} from '../errors/conversion.errors'
import type { IUserPresetRepository, CreateUserPresetData, UpdateUserPresetData } from '../repositories/user-preset.repository'
import type { UserPreset, UserPresetListResponse, UserPresetResponse } from '../types/conversion.types'

function toResponse(preset: UserPreset): UserPresetResponse {
  return {
    id: preset.id,
    name: preset.name,
    description: preset.description,
    values: preset.values,
    isDefault: preset.isDefault,
    lastUsedAt: preset.lastUsedAt,
    usageCount: preset.usageCount,
    createdAt: preset.createdAt,
    updatedAt: preset.updatedAt,
  }
}

export class ListUserPresetsUseCase {
  constructor(private readonly repo: IUserPresetRepository) {}

  async execute(userId: string): Promise<UserPresetListResponse> {
    const presets = await this.repo.findAllByUserId(userId)
    return {
      presets: presets.map(toResponse),
      limit: env.MAX_USER_PRESETS,
    }
  }
}

export class CreateUserPresetUseCase {
  constructor(
    private readonly repo: IUserPresetRepository,
    private readonly maxPresets: number = env.MAX_USER_PRESETS,
  ) {}

  async execute(userId: string, input: CreateUserPresetData): Promise<UserPresetResponse> {
    const existing = await this.repo.findAllByUserId(userId)

    if (existing.length >= this.maxPresets) {
      throw new PresetLimitReachedError(this.maxPresets)
    }

    const duplicate = existing.find((p) => p.name === input.name)
    if (duplicate) {
      throw new DuplicatePresetNameError(input.name)
    }

    const preset = await this.repo.create({ ...input, userId })

    if (input.isDefault) {
      await this.repo.toggleDefault(preset.id, userId)
    }

    return toResponse(preset)
  }
}

export class UpdateUserPresetMetaUseCase {
  constructor(private readonly repo: IUserPresetRepository) {}

  async execute(
    presetId: string,
    userId: string,
    input: UpdateUserPresetData,
  ): Promise<UserPresetResponse> {
    const existing = await this.repo.findById(presetId, userId)
    if (!existing) {
      throw new UserPresetNotFoundError(presetId)
    }

    if (input.isDefault) {
      await this.repo.toggleDefault(presetId, userId)
    }

    const updated = await this.repo.updateMeta(presetId, userId, input)
    return toResponse(updated)
  }
}

export class UpdateUserPresetValuesUseCase {
  constructor(private readonly repo: IUserPresetRepository) {}

  async execute(
    presetId: string,
    userId: string,
    values: Record<string, string | number | boolean>,
  ): Promise<UserPresetResponse> {
    const existing = await this.repo.findById(presetId, userId)
    if (!existing) {
      throw new UserPresetNotFoundError(presetId)
    }

    const updated = await this.repo.updateValues(presetId, userId, values)
    return toResponse(updated)
  }
}

export class DeleteUserPresetUseCase {
  constructor(private readonly repo: IUserPresetRepository) {}

  async execute(presetId: string, userId: string): Promise<void> {
    const existing = await this.repo.findById(presetId, userId)
    if (!existing) {
      throw new UserPresetNotFoundError(presetId)
    }

    await this.repo.delete(presetId, userId)
  }
}
