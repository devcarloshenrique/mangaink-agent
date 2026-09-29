import type { FastifyReply, FastifyRequest } from 'fastify'
import { SearchSourcesUseCase } from '../use-cases/search-sources.use-case'
import type { CoverProxyQuery, SearchSourcesQuery } from '../dtos/search-sources.dto'
import { getProviderResolver } from '../utils/resolve-provider'
import {
  assertValidImage,
  detectImageContentType,
  InvalidImageContentError,
} from '../../../shared/utils/image-validation'

const searchUseCase = new SearchSourcesUseCase()

export async function searchSources(request: FastifyRequest, reply: FastifyReply) {
  const { q, providers, limit, offset, language, timeoutMs, maxProviders } =
    request.query as SearchSourcesQuery
  const result = await searchUseCase.execute({
    query: q,
    providers,
    limitPerProvider: limit,
    offsetPerProvider: offset,
    language,
    timeoutMs,
    maxProviders,
  })
  return reply.send(result)
}

export async function coverProxy(
  request: FastifyRequest<{ Querystring: CoverProxyQuery }>,
  reply: FastifyReply,
) {
  const { url, provider } = request.query as CoverProxyQuery

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return reply.status(400).send({ error: 'URL inválida ou malformada' })
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return reply.status(400).send({ error: 'Protocolo inválido' })
  }

  const strategy = getProviderResolver().getBySlug(provider)
  if (!strategy) {
    return reply.status(404).send({ error: 'Provider não encontrado' })
  }

  const host = parsed.hostname.toLowerCase()
  const isDomainAllowed = strategy.allowedDomains.some((d) => {
    const normalizedD = d.toLowerCase()
    return host === normalizedD || host.endsWith(`.${normalizedD}`)
  })

  if (!isDomainAllowed) {
    return reply.status(403).send({ error: 'Domínio não permitido para este provider' })
  }

  try {
    const { buffer, contentType } = await strategy.downloadImage(url)
    assertValidImage(buffer)
    const safeContentType = detectImageContentType(buffer) || contentType || 'image/jpeg'

    return reply
      .header('Content-Type', safeContentType)
      .header('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800')
      .send(buffer)
  } catch (err: any) {
    if (err instanceof InvalidImageContentError) {
      return reply.status(422).send({ error: 'Conteúdo retornado não é uma imagem válida' })
    }
    return reply.status(502).send({ error: 'Falha ao obter imagem da fonte' })
  }
}

