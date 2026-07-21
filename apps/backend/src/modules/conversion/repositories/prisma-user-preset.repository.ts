import type { Prisma } from '@prisma/client'
import { getPrisma } from '../../../shared/database/prisma'
import { UserPresetNotFoundError } from '../errors/conversion.errors'
import type { IUserPresetRepository, CreateUserPresetData, UpdateUserPresetData } from './user-preset.repository'
import type { UserPreset } from '../types/conversion.types'

function toDomain(row: {
  id: string
  userId: string
  name: string
  description: string | null
  values: Prisma.JsonValue
  isDefault: boolean
  lastUsedAt: Date | null
  usageCount: number
  createdAt: Date
  updatedAt: Date
}): UserPreset {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    description: row.description,
    values: row.values as Record<string, string | number | boolean>,
    isDefault: row.isDefault,
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    usageCount: row.usageCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export class PrismaUserPresetRepository implements IUserPresetRepository {
  async findAllByUserId(userId: string): Promise<UserPreset[]> {
    const rows = await getPrisma().userPreset.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })
    return rows.map(toDomain)
  }

  async findById(presetId: string, userId: string): Promise<UserPreset | null> {
    const row = await getPrisma().userPreset.findFirst({
      where: { id: presetId, userId },
    })
    return row ? toDomain(row) : null
  }

  async create(data: CreateUserPresetData): Promise<UserPreset> {
    const row = await getPrisma().userPreset.create({
      data: {
        userId: data.userId,
        name: data.name,
        description: data.description ?? null,
        values: data.values as Prisma.InputJsonValue,
        isDefault: data.isDefault ?? false,
      },
    })
    return toDomain(row)
  }

  async updateMeta(
    presetId: string,
    userId: string,
    data: UpdateUserPresetData,
  ): Promise<UserPreset> {
    const existing = await getPrisma().userPreset.findFirst({
      where: { id: presetId, userId },
    })
    if (!existing) {
      throw new UserPresetNotFoundError(presetId)
    }

    const row = await getPrisma().userPreset.update({
      where: { id: presetId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.isDefault !== undefined && { isDefault: data.isDefault }),
      },
    })
    return toDomain(row)
  }

  async updateValues(
    presetId: string,
    userId: string,
    values: Record<string, string | number | boolean>,
  ): Promise<UserPreset> {
    const existing = await getPrisma().userPreset.findFirst({
      where: { id: presetId, userId },
    })
    if (!existing) {
      throw new UserPresetNotFoundError(presetId)
    }

    const row = await getPrisma().userPreset.update({
      where: { id: presetId },
      data: { values: values as Prisma.InputJsonValue },
    })
    return toDomain(row)
  }

  async delete(presetId: string, userId: string): Promise<void> {
    const existing = await getPrisma().userPreset.findFirst({
      where: { id: presetId, userId },
    })
    if (!existing) {
      throw new UserPresetNotFoundError(presetId)
    }

    await getPrisma().userPreset.delete({ where: { id: presetId } })
  }

  async toggleDefault(presetId: string, userId: string): Promise<void> {
    await getPrisma().$transaction(async (tx) => {
      await tx.userPreset.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      })

      const target = await tx.userPreset.findFirst({
        where: { id: presetId, userId },
      })
      if (!target) {
        throw new UserPresetNotFoundError(presetId)
      }

      await tx.userPreset.update({
        where: { id: presetId },
        data: { isDefault: true },
      })
    })
  }

  async incrementUsage(presetId: string): Promise<void> {
    await getPrisma().userPreset.update({
      where: { id: presetId },
      data: { usageCount: { increment: 1 } },
    })
  }

  async touchLastUsed(presetId: string): Promise<void> {
    await getPrisma().userPreset.update({
      where: { id: presetId },
      data: { lastUsedAt: new Date() },
    })
  }
}
