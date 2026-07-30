import type { FastifyReply, FastifyRequest } from 'fastify'
import { env } from '../../../shared/config/env'
import { SourceNotFoundError } from '../errors/scraping.errors'
import { ProviderNotFoundError } from '../errors/scraping.errors'
import { ProviderResolver } from '../providers/provider-resolver'
import { ChapterImageService } from '../services/chapter-image.service'
import { PrismaSourceRepository } from '../repositories/prisma-source.repository'

const resolver = new ProviderResolver()

export async function deleteChapterCache(
  request: FastifyRequest<{ Params: { sourceId: string; chapterId: string } }>,
  reply: FastifyReply,
) {
  const { sourceId, chapterId } = request.params

  const sourceRepo = new PrismaSourceRepository()
  const metadata = await sourceRepo.load(sourceId)
  if (!metadata) {
    throw new SourceNotFoundError(sourceId)
  }

  const provider = resolver.listAll().find((p) => p.slug === metadata.provider.slug)
  if (!provider) {
    throw new ProviderNotFoundError(metadata.url)
  }

  const service = new ChapterImageService(provider, sourceId, chapterId, env.STORAGE_PATH)
  const result = await service.deleteCache()

  return reply.code(200).send(result)
}
