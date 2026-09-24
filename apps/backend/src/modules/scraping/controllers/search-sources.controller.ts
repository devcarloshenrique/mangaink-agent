import type { FastifyReply, FastifyRequest } from 'fastify'
import { SearchSourcesUseCase } from '../use-cases/search-sources.use-case'
import type { SearchSourcesQuery } from '../dtos/search-sources.dto'

const searchUseCase = new SearchSourcesUseCase()

export async function searchSources(request: FastifyRequest, reply: FastifyReply) {
  const { q, providers, limit, offset, language } = request.query as SearchSourcesQuery
  const result = await searchUseCase.execute({
    query: q,
    providers,
    limitPerProvider: limit,
    offsetPerProvider: offset,
    language,
  })
  return reply.send(result)
}
