import type { FastifyReply, FastifyRequest } from 'fastify'
import type { InspectSourceBody, InspectSourceQuery } from '../dtos/inspect-source.dto'
import type { RuntimeAdapters } from '../../../shared/infra/factory'
import type { IQueueService } from '../../../shared/infra'
import type { SourceInspectJob } from '../types/source.types'
import { InspectSourceUseCase, setInspectQueueService, setInspectLockService } from '../use-cases/inspect-source.use-case'
import { InspectQueueService } from '../services/inspect-queue.service'
import { ProviderNotFoundError, InvalidUrlError } from '../errors/scraping.errors'

/**
 * Factory do handler de inspeção de fonte. Injeta no use-case a fila e o lock
 * do `runtime` (compartilhados com o worker — in-memory no embedded, Redis no
 * web). Sem runtime, o use-case usa os defaults web (lazy).
 */
export function createInspectSourceController(runtime?: RuntimeAdapters) {
  const useCase = new InspectSourceUseCase()
  if (runtime) {
    setInspectQueueService(
      new InspectQueueService(runtime.getQueue('source-inspect') as IQueueService<SourceInspectJob>),
    )
    setInspectLockService(runtime.lock)
  }

  return async function inspectSource(
    request: FastifyRequest<{ Body: InspectSourceBody; Querystring: InspectSourceQuery }>,
    reply: FastifyReply,
  ) {
    const { url } = request.body
    const refresh = request.query.refresh ?? false

    try {
      const result = await useCase.execute({ url, refresh })

      if (result.status === 'ready') {
        return reply.code(200).send(result)
      }

      return reply.code(202).send(result)
    } catch (error) {
      if (error instanceof InvalidUrlError) {
        return reply.code(400).send({ error: error.message })
      }
      if (error instanceof ProviderNotFoundError) {
        return reply.code(422).send({ error: error.message })
      }
      throw error
    }
  }
}
