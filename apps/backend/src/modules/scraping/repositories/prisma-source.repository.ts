import type { Prisma } from '@prisma/client'
import { getPrisma } from '../../../shared/database/prisma'
import type { SourceCacheRepository } from './source-cache.repository'
import type { SourceMetadataFile } from '../types/metadata.types'
import type { MetadataCache } from '../types/metadata.types'
import type { MangaMetadata, Chapter, Cover, Statistics } from '../types/source.types'
import type { ProviderInfo } from '../types/provider.types'

export class PrismaSourceRepository implements SourceCacheRepository {
  async exists(sourceId: string): Promise<boolean> {
    const count = await getPrisma().source.count({ where: { sourceId } })
    return count > 0
  }

  async load(sourceId: string): Promise<SourceMetadataFile | null> {
    const row = await getPrisma().source.findUnique({
      where: { sourceId },
      include: {
        chapters: true,
        covers: true,
      },
    })

    if (!row) return null

    const provider: ProviderInfo = {
      slug: row.providerSlug,
      name: row.providerName,
      engine: 'cheerio',
    }

    const metadata = row.metadata as unknown as MangaMetadata

    const chapters: Chapter[] = row.chapters
      .map((ch) => ({
        id: ch.chapterId,
        number: ch.number,
        title: ch.title,
        url: ch.url,
        pages: ch.pages,
        volume: ch.volume,
        isDownloaded: false,
      }))
      .sort((a, b) => parseFloat(a.number) - parseFloat(b.number))

    const covers: Cover[] = row.covers.map((cv) => ({
      id: cv.coverId,
      type: cv.type as Cover['type'],
      label: cv.label,
      imageUrl: cv.imageUrl,
    }))

    const statistics: Statistics = (row.statistics as unknown as Statistics) ?? {
      chapters: chapters.length,
      covers: covers.length,
    }

    const cache: MetadataCache = {
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      lastAccessAt: row.lastAccessAt.toISOString(),
      cacheTtlHours: row.cacheTtlHours,
      retentionDays: row.retentionDays,
    }

    return {
      sourceId: row.sourceId,
      status: 'ready',
      provider,
      source: {
        url: row.url,
        language: row.language,
      },
      metadata,
      chapters,
      covers,
      statistics,
      cache,
    }
  }

  async save(sourceId: string, data: SourceMetadataFile): Promise<void> {
    const ttlExpiresAt = new Date(
      new Date(data.cache.updatedAt).getTime() + data.cache.cacheTtlHours * 60 * 60 * 1000,
    )

    const newChapterIds = data.chapters.map((c) => c.id)
    const newCoverIds = data.covers.map((c) => c.id)

    const sourceCreate = {
      sourceId,
      url: data.source.url,
      language: data.source.language,
      metadata: data.metadata as unknown as Prisma.InputJsonValue,
      statistics: data.statistics as unknown as Prisma.InputJsonValue,
      status: data.status,
      providerSlug: data.provider.slug,
      providerName: data.provider.name,
      cacheTtlHours: data.cache.cacheTtlHours,
      retentionDays: data.cache.retentionDays,
      lastAccessAt: new Date(data.cache.lastAccessAt),
      ttlExpiresAt,
    }

    await getPrisma().$transaction(
      async (tx) => {
        await tx.source.upsert({
          where: { sourceId },
          create: sourceCreate,
          update: sourceCreate,
        })

        if (newChapterIds.length > 0) {
          await tx.chapter.deleteMany({
            where: {
              sourceId,
              chapterId: { notIn: newChapterIds },
            },
          })
        } else {
          await tx.chapter.deleteMany({ where: { sourceId } })
        }

        if (newCoverIds.length > 0) {
          await tx.cover.deleteMany({
            where: {
              sourceId,
              coverId: { notIn: newCoverIds },
            },
          })
        } else {
          await tx.cover.deleteMany({ where: { sourceId } })
        }

        for (const ch of data.chapters) {
          await tx.chapter.upsert({
            where: { sourceId_chapterId: { sourceId, chapterId: ch.id } },
            create: {
              chapterId: ch.id,
              sourceId,
              number: ch.number,
              title: ch.title,
              url: ch.url,
              pages: ch.pages,
              volume: ch.volume,
            },
            update: {
              number: ch.number,
              title: ch.title,
              url: ch.url,
              pages: ch.pages,
              volume: ch.volume,
              sourceId,
            },
          })
        }

        for (const cv of data.covers) {
          await tx.cover.upsert({
            where: { sourceId_coverId: { sourceId, coverId: cv.id } },
            create: {
              coverId: cv.id,
              sourceId,
              type: cv.type,
              label: cv.label,
              imageUrl: cv.imageUrl,
            },
            update: {
              type: cv.type,
              label: cv.label,
              imageUrl: cv.imageUrl,
              sourceId,
            },
          })
        }

        const verifyChapters = await tx.chapter.count({ where: { sourceId } })
        const verifyCovers = await tx.cover.count({ where: { sourceId } })
        console.log(
          `[PrismaSourceRepo] Save ${sourceId}: ` +
            `${data.chapters.length} chapters enviados, ${verifyChapters} no banco | ` +
            `${data.covers.length} covers enviados, ${verifyCovers} no banco`,
        )
      },
      {
        timeout: 30_000,
        maxWait: 10_000,
      },
    )
  }

  async update(sourceId: string, patch: Partial<MetadataCache>): Promise<void> {
    const current = await getPrisma().source.findUnique({
      where: { sourceId },
      select: { updatedAt: true },
    })
    if (!current) return

    const data: Record<string, unknown> = {}

    if (patch.updatedAt !== undefined) {
      data.updatedAt = new Date(patch.updatedAt)
    }
    if (patch.lastAccessAt !== undefined) {
      data.lastAccessAt = new Date(patch.lastAccessAt)
    }
    if (patch.cacheTtlHours !== undefined) {
      data.cacheTtlHours = patch.cacheTtlHours
      const baseUpdatedAt = patch.updatedAt
        ? new Date(patch.updatedAt)
        : current.updatedAt
      data.ttlExpiresAt = new Date(
        baseUpdatedAt.getTime() + patch.cacheTtlHours * 60 * 60 * 1000,
      )
    }
    if (patch.retentionDays !== undefined) {
      data.retentionDays = patch.retentionDays
    }

    if (Object.keys(data).length === 0) return

    await getPrisma().source.update({
      where: { sourceId },
      data,
    })
  }

  async delete(sourceId: string): Promise<void> {
    try {
      await getPrisma().source.delete({ where: { sourceId } })
    } catch {
      // Silently ignore if already deleted (cascade handles children)
    }
  }

  async getPlaceholderIndices(sourceId: string, chapterId: string): Promise<number[]> {
    const chapter = await getPrisma().chapter.findFirst({
      where: { sourceId, chapterId },
      select: { placeholderPageIndices: true },
    })
    if (!chapter?.placeholderPageIndices) return []
    return chapter.placeholderPageIndices as unknown as number[]
  }

  async updatePlaceholderIndices(
    sourceId: string,
    chapterId: string,
    indices: number[],
  ): Promise<void> {
    await getPrisma().chapter.updateMany({
      where: { sourceId, chapterId },
      data: { placeholderPageIndices: indices as Prisma.InputJsonValue },
    })
  }
}
