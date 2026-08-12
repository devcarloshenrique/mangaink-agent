import type { FastifyReply, FastifyRequest } from 'fastify'
import { getProviderRepository } from '../../../shared/database/repositories'
import type { ProviderParams, UpdateProviderBody } from '../dtos/provider.dto'
import { ListProvidersUseCase } from '../use-cases/list-providers.use-case'
import { UpdateProviderUseCase } from '../use-cases/update-provider.use-case'

const listUseCase = new ListProvidersUseCase(getProviderRepository())
const updateUseCase = new UpdateProviderUseCase(getProviderRepository())

export async function listProviders(_request: FastifyRequest, reply: FastifyReply) {
  const providers = await listUseCase.execute()
  return reply.send({ providers })
}

export async function updateProvider(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { slug } = request.params as ProviderParams
  // ProviderBySlugNotFoundError é mapeado → 404 pelo error handler global.
  const provider = await updateUseCase.execute(slug, request.body as UpdateProviderBody)
  return reply.send(provider)
}
