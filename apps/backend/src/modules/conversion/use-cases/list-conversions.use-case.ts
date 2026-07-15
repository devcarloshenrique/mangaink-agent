import type { ConversionRepository } from '../repositories/conversion.repository'
import type {
  ConversionListFilters,
  ConversionListPagination,
  ConversionListResult,
} from '../types/conversion.types'
import type { ListConversionsQuery } from '../dtos/list-conversions.dto'

export class ListConversionsUseCase {
  constructor(private readonly conversions: ConversionRepository) {}

  async execute(
    userId: string,
    query: ListConversionsQuery,
  ): Promise<ConversionListResult> {
    const filters: ConversionListFilters = {}
    if (query.status) {
      filters.status = query.status
    }
    if (query.sourceId) {
      filters.sourceId = query.sourceId
    }

    const pagination: ConversionListPagination = {
      page: query.page,
      limit: query.limit,
    }

    return this.conversions.listByUser(userId, filters, pagination)
  }
}