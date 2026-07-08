import type { FastifyReply, FastifyRequest } from 'fastify'
import { ProviderResolver } from '../providers/provider-resolver'

const resolver = new ProviderResolver()

export async function listProviders(_request: FastifyRequest, reply: FastifyReply) {
  const providers = resolver.listAll().map((p) => ({
    slug: p.slug,
    name: p.name,
    engine: p.engine,
    allowedDomains: p.allowedDomains,
  }))

  return reply.send({ providers })
}
