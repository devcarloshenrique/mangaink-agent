import type { SourceCacheRepository } from '../../../modules/scraping/repositories/source-cache.repository'
import type { ConversionRepository } from '../../../modules/conversion/repositories/conversion.repository'
import type { ConversionJobRepository } from '../../../modules/conversion/repositories/conversion-job.repository'

import { PrismaSourceRepository } from '../../../modules/scraping/repositories/prisma-source.repository'
import { PrismaConversionRepository } from '../../../modules/conversion/repositories/prisma-conversion.repository'
import { PrismaJobRepository } from '../../../modules/conversion/repositories/prisma-job.repository'

export function getSourceRepository(): SourceCacheRepository {
  return new PrismaSourceRepository()
}

export function getConversionRepository(): ConversionRepository {
  return new PrismaConversionRepository()
}

export function getConversionJobRepository(): ConversionJobRepository {
  return new PrismaJobRepository()
}
