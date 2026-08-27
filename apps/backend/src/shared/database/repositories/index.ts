import type { SourceCacheRepository } from '../../../modules/scraping/repositories/source-cache.repository'
import type { ProviderRepository } from '../../../modules/scraping/repositories/provider.repository'
import type { ConversionRepository } from '../../../modules/conversion/repositories/conversion.repository'
import type { ConversionJobRepository } from '../../../modules/conversion/repositories/conversion-job.repository'
import type { IUserPresetRepository } from '../../../modules/conversion/repositories/user-preset.repository'
import type { UserChapterProgressRepository } from '../../../modules/reading/repositories/user-chapter-progress.repository'
import type { NotificationRepository } from '../../../modules/notification/repositories/notification.repository'
import type { IStatusStore } from '../../infra'

import { PrismaSourceRepository } from '../../../modules/scraping/repositories/prisma-source.repository'
import { PrismaProviderRepository } from '../../../modules/scraping/repositories/prisma-provider.repository'
import { PrismaConversionRepository } from '../../../modules/conversion/repositories/prisma-conversion.repository'
import { PrismaJobRepository } from '../../../modules/conversion/repositories/prisma-job.repository'
import { PrismaUserPresetRepository } from '../../../modules/conversion/repositories/prisma-user-preset.repository'
import { PrismaUserChapterProgressRepository } from '../../../modules/reading/repositories/prisma-user-chapter-progress.repository'
import { PrismaNotificationRepository } from '../../../modules/notification/repositories/prisma-notification.repository'

export function getSourceRepository(): SourceCacheRepository {
  return new PrismaSourceRepository()
}

export function getProviderRepository(): ProviderRepository {
  return new PrismaProviderRepository()
}

export function getConversionRepository(statusStore?: IStatusStore): ConversionRepository {
  return new PrismaConversionRepository(statusStore)
}

export function getConversionJobRepository(): ConversionJobRepository {
  return new PrismaJobRepository()
}

export function getUserPresetRepository(): IUserPresetRepository {
  return new PrismaUserPresetRepository()
}

export function getUserChapterProgressRepository(): UserChapterProgressRepository {
  return new PrismaUserChapterProgressRepository()
}

export function getNotificationRepository(): NotificationRepository {
  return new PrismaNotificationRepository()
}
