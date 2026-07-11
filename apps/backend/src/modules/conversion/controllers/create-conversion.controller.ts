import type { FastifyReply, FastifyRequest } from 'fastify'
import type { CreateConversionUseCase } from '../use-cases/create-conversion.use-case'
import { ValidationError, SourceNotFoundError, DuplicateChapterError, ChapterNotFoundError } from '../errors/conversion.errors'
import type { Book, ConversionConfig, CoverRef } from '../types/conversion.types'

export function createConversionHandler(useCase: CreateConversionUseCase) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const body = request.body as {
      sourceId: string
      cover: CoverRef
      output: { deviceId: string; format: string }
      metadata?: { title?: string; author?: string }
      books: Array<{ title: string; chapters: string[]; cover?: CoverRef }>
      options?: Record<string, string | number | boolean>
    }

    try {
      const config: ConversionConfig = {
        sourceId: body.sourceId,
        cover: body.cover,
        output: body.output,
        metadata: body.metadata ?? {},
        books: body.books as Book[],
        options: body.options ?? {},
      }
      const result = await useCase.execute(config)
      return reply.code(202).send(result)
    } catch (error) {
      if (error instanceof ValidationError) return reply.code(400).send({ error: error.message })
      if (
        error instanceof SourceNotFoundError ||
        error instanceof ChapterNotFoundError ||
        error instanceof DuplicateChapterError
      ) {
        return reply.code(404).send({ error: error.message })
      }
      throw error
    }
  }
}