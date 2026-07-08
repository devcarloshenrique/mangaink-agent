import type { FastifyReply, FastifyRequest } from 'fastify'
import type { InspectSourceBody, InspectSourceQuery } from '../dtos/inspect-source.dto'
import { InspectSourceUseCase } from '../use-cases/inspect-source.use-case'
import { ProviderNotFoundError, InvalidUrlError } from '../errors/scraping.errors'

const useCase = new InspectSourceUseCase()

export async function inspectSource(
  request: FastifyRequest<{ Body: InspectSourceBody; Querystring: InspectSourceQuery }>,
  reply: FastifyReply,
) {
  const { url } = request.body
  const refresh = request.query.refresh ?? false

  try {
    const result = await useCase.execute({ url, refresh })

    if (result.status === 'ready') {
      return reply.code(200).send(result)
    }

    return reply.code(202).send(result)
  } catch (error) {
    if (error instanceof InvalidUrlError) {
      return reply.code(400).send({ error: error.message })
    }
    if (error instanceof ProviderNotFoundError) {
      return reply.code(422).send({ error: error.message })
    }
    throw error
  }
}
