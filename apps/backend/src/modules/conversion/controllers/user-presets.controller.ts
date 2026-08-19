import type { FastifyReply, FastifyRequest } from 'fastify'
import { PrismaUserPresetRepository } from '../repositories/prisma-user-preset.repository'
import {
  ListUserPresetsUseCase,
  CreateUserPresetUseCase,
  UpdateUserPresetMetaUseCase,
  UpdateUserPresetValuesUseCase,
  DeleteUserPresetUseCase,
} from '../use-cases/user-presets.use-case'

const repo = new PrismaUserPresetRepository()
const listUseCase = new ListUserPresetsUseCase(repo)
const createUseCase = new CreateUserPresetUseCase(repo)
const updateMetaUseCase = new UpdateUserPresetMetaUseCase(repo)
const updateValuesUseCase = new UpdateUserPresetValuesUseCase(repo)
const deleteUseCase = new DeleteUserPresetUseCase(repo)

export async function listUserPresetsHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const userId = (request.user as { sub: string }).sub
  const result = await listUseCase.execute(userId)
  return reply.send(result)
}

export async function createUserPresetHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const userId = (request.user as { sub: string }).sub
  const result = await createUseCase.execute(userId, request.body as {
    name: string
    description?: string
    values: Record<string, string | number | boolean>
    isDefault?: boolean
  })
  return reply.code(201).send(result)
}

export async function updateUserPresetMetaHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { presetId } = request.params as { presetId: string }
  const userId = (request.user as { sub: string }).sub
  const result = await updateMetaUseCase.execute(presetId, userId, request.body as {
    name?: string
    description?: string | null
    isDefault?: boolean
  })
  return reply.send(result)
}

export async function updateUserPresetValuesHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { presetId } = request.params as { presetId: string }
  const userId = (request.user as { sub: string }).sub
  const result = await updateValuesUseCase.execute(
    presetId,
    userId,
    (request.body as { values: Record<string, string | number | boolean> }).values,
  )
  return reply.send(result)
}

export async function deleteUserPresetHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { presetId } = request.params as { presetId: string }
  const userId = (request.user as { sub: string }).sub
  await deleteUseCase.execute(presetId, userId)
  return reply.code(204).send()
}
