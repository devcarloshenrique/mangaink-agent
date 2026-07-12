import type { FastifyReply, FastifyRequest } from 'fastify'
import type { CreateConversionUseCase } from '../use-cases/create-conversion.use-case'
import type { Book, ConversionConfig, CoverRef, ErrorHandlingStrategy } from '../types/conversion.types'

export function createConversionHandler(useCase: CreateConversionUseCase) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const body = request.body as {
      sourceId: string
      cover: CoverRef
      output: { deviceId: string; format: string }
      metadata?: { title?: string; author?: string }
      books: Array<{ title: string; chapters: string[]; cover?: CoverRef }>
      options?: Record<string, string | number | boolean>
      errorHandlingStrategy?: ErrorHandlingStrategy
    }

    const userId = (request.user as { sub: string }).sub

    const config: ConversionConfig = {
      sourceId: body.sourceId,
      cover: body.cover,
      output: body.output,
      metadata: body.metadata ?? {},
      books: body.books as Book[],
      options: body.options ?? {},
      errorHandlingStrategy: body.errorHandlingStrategy,
      userId,
    }
    const result = await useCase.execute(config)
    return reply.code(202).send(result)
  }
}