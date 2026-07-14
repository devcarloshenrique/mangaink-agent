import { isPrismaBackend } from '../../config/repo-mode'

import type { SourceCacheRepository } from '../../../modules/scraping/repositories/source-cache.repository'
import type { ConversionRepository } from '../../../modules/conversion/repositories/conversion.repository'
import type { ConversionJobRepository } from '../../../modules/conversion/repositories/conversion-job.repository'

import { FilesystemSourceRepository } from '../../../modules/scraping/repositories/filesystem-source.repository'
import { PrismaSourceRepository } from '../../../modules/scraping/repositories/prisma-source.repository'
import { FilesystemConversionRepository } from '../../../modules/conversion/repositories/filesystem-conversion.repository'
import { FilesystemJobRepository } from '../../../modules/conversion/repositories/filesystem-job.repository'

export function getSourceRepository(): SourceCacheRepository {
  if (isPrismaBackend()) {
    return new PrismaSourceRepository()
  }

  return new FilesystemSourceRepository()
}

export function getConversionRepository(): ConversionRepository {
  if (isPrismaBackend()) {
    throw new Error(
      'Prisma adapter for ConversionRepository not implemented yet — implement in subsequent change',
    )
  }

  return new FilesystemConversionRepository()
}

export function getConversionJobRepository(): ConversionJobRepository {
  if (isPrismaBackend()) {
    throw new Error(
      'Prisma adapter for ConversionJobRepository not implemented yet — implement in subsequent change',
    )
  }

  return new FilesystemJobRepository()
}
