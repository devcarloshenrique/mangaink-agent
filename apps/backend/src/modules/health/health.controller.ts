import type { FastifyRequest, FastifyReply } from 'fastify'

export async function healthCheck(_request: FastifyRequest, reply: FastifyReply) {
  return reply.send({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    uptime: process.uptime(),
  })
}
