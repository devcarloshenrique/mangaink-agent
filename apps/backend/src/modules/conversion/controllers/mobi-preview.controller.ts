import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { extname } from 'node:path'
import type { FastifyReply, FastifyRequest } from 'fastify'
import type { StartMobiPreviewUseCase, GetMobiPreviewStatusUseCase, GetMobiPreviewPageUseCase } from '../use-cases/mobi-preview.use-case'
import type {
  MobiPreviewParams,
  MobiPreviewPageParams,
} from '../dtos/mobi-preview.dto'

const MIME_MAP: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.avif': 'image/avif',
}

/**
 * POST /api/conversions/:conversionId/jobs/:jobId/preview
 *
 * Idempotente: enfileira extracao no BullMQ se cache /temp/ expirou; caso
 * contrario retorna 200 {status:'ready', totalPages, cached:true}.
 */
export function startMobiPreviewHandler(useCase: StartMobiPreviewUseCase) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const { conversionId, jobId } = request.params as MobiPreviewParams
    const userId = (request.user as { sub: string }).sub

    const result = await useCase.execute(conversionId, jobId, userId)

    // 200 em cache hit, 202 em processamento recem-enfileirado.
    reply.code(result.status === 'ready' ? 200 : 202).send(result)
  }
}

/**
 * GET /api/conversions/:conversionId/jobs/:jobId/preview
 *
 * Status agregado (Redis Hash live + FS index.json/count/cacheUntil).
 * Usado pelo frontend em poll (1s) para acompanhar o progresso de extracao.
 */
export function getMobiPreviewStatusHandler(useCase: GetMobiPreviewStatusUseCase) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const { conversionId, jobId } = request.params as MobiPreviewParams
    const userId = (request.user as { sub: string }).sub

    const status = await useCase.execute(conversionId, jobId, userId)
    reply.code(200).send(status)
  }
}

/**
 * GET /api/conversions/:conversionId/jobs/:jobId/preview/pages/:index
 *
 * Serve a pagina individual como stream. `Cache-Control: max-age=86400`
 * (cache publico — conteudo imutavel durante a validade do /temp/).
 * Lanca `PreviewNotReadyError` se a pagina ainda nao existe no disco.
 */
export function getMobiPreviewPageHandler(useCase: GetMobiPreviewPageUseCase) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const { conversionId, jobId, index } = request.params as MobiPreviewPageParams
    const userId = (request.user as { sub: string }).sub

    const { filePath, contentType } = await useCase.execute(conversionId, jobId, userId, index)

    const fileStats = await stat(filePath)

    reply.header('Content-Type', contentType)
    reply.header('Cache-Control', 'public, max-age=86400, immutable')
    reply.header('Content-Length', fileStats.size)

    const ext = extname(filePath).toLowerCase()
    const mime = MIME_MAP[ext] ?? contentType
    reply.header('Content-Type', mime)

    return reply.send(createReadStream(filePath))
  }
}