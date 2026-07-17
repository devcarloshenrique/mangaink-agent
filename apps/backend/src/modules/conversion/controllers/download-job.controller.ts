import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { extname } from 'node:path'
import type { FastifyReply, FastifyRequest } from 'fastify'
import type { DownloadJobUseCase } from '../use-cases/download-job.use-case'
import type { DownloadJobParams } from '../dtos/download-job.dto'

const MIME_MAP: Record<string, string> = {
  '.epub': 'application/epub+zip',
  '.mobi': 'application/x-mobipocket-ebook',
  '.cbz': 'application/vnd.comicbook+zip',
  '.pdf': 'application/pdf',
  '.zip': 'application/zip',
}

export function downloadJobHandler(useCase: DownloadJobUseCase) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const { conversionId, jobId } = request.params as DownloadJobParams
    const userId = (request.user as { sub: string }).sub

    const { filePath, filename } = await useCase.execute(conversionId, jobId, userId)

    const ext = extname(filename).toLowerCase()
    const contentType = MIME_MAP[ext] ?? 'application/octet-stream'

    const fileStats = await stat(filePath)

    reply.header('Content-Type', contentType)
    reply.header('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`)
    reply.header('Content-Length', fileStats.size)

    return reply.send(createReadStream(filePath))
  }
}
