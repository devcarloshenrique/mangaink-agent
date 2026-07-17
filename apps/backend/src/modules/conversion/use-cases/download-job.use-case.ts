import { join } from 'node:path'
import { pathExists } from '../../../shared/utils/filesystem'
import { env } from '../../../shared/config/env'
import type { ConversionRepository } from '../repositories/conversion.repository'
import type { ConversionJobRepository } from '../repositories/conversion-job.repository'
import {
  ConversionNotFoundError,
  ForbiddenError,
} from '../errors/conversion.errors'

export interface DownloadJobResult {
  filePath: string
  filename: string
}

export class DownloadJobUseCase {
  constructor(
    private readonly conversions: ConversionRepository,
    private readonly jobs: ConversionJobRepository,
  ) {}

  async execute(
    conversionId: string,
    jobId: string,
    userId: string,
  ): Promise<DownloadJobResult> {
    const conversion = await this.conversions.findById(conversionId)
    if (!conversion) {
      throw new ConversionNotFoundError(conversionId)
    }

    if (conversion.config.userId !== userId) {
      throw new ForbiddenError(conversionId)
    }

    const job = await this.jobs.findById(jobId)
    if (!job) {
      throw new ConversionNotFoundError(jobId)
    }

    if (!job.outputFile) {
      throw new ConversionNotFoundError(jobId)
    }

    const filePath = join(
      env.CONVERSIONS_STORAGE_PATH,
      conversionId,
      'jobs',
      jobId,
      'output',
      job.outputFile,
    )

    if (!(await pathExists(filePath))) {
      throw new ConversionNotFoundError(jobId)
    }

    return { filePath, filename: job.outputFile }
  }
}
