import { isPrismaBackend } from '../../config/repo-mode'

import type { SourceCacheRepository } from '../../../modules/scraping/repositories/source-cache.repository'
import type { ConversionRepository } from '../../../modules/conversion/repositories/conversion.repository'
import type { ConversionJobRepository } from '../../../modules/conversion/repositories/conversion-job.repository'

import { FilesystemSourceRepository } from '../../../modules/scraping/repositories/filesystem-source.repository'
import { PrismaSourceRepository } from '../../../modules/scraping/repositories/prisma-source.repository'
import { FilesystemConversionRepository } from '../../../modules/conversion/repositories/filesystem-conversion.repository'
import { FilesystemJobRepository } from '../../../modules/conversion/repositories/filesystem-job.repository'
import { PrismaConversionRepository } from '../../../modules/conversion/repositories/prisma-conversion.repository'
import { PrismaJobRepository } from '../../../modules/conversion/repositories/prisma-job.repository'

export function getSourceRepository(): SourceCacheRepository {
  if (isPrismaBackend()) {
    return new PrismaSourceRepository()
  }

  return new FilesystemSourceRepository()
}

export function getConversionRepository(): ConversionRepository {
  if (isPrismaBackend()) {
    return new PrismaConversionRepository()
  }

  return new FilesystemConversionRepository()
}

export function getConversionJobRepository(): ConversionJobRepository {
  if (isPrismaBackend()) {
    return new PrismaJobRepository()
  }

  return new FilesystemJobRepository()
}
