import { describe, it, expect, vi } from 'vitest'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { verifyJwtOptional } from './verify-jwt-optional'

function createMockRequest(jwtVerifyResult: 'success' | 'failure'): FastifyRequest {
  return {
    jwtVerify: vi.fn().mockImplementation(() => {
      if (jwtVerifyResult === 'failure') throw new Error('invalid token')
      return Promise.resolve()
    }),
  } as unknown as FastifyRequest
}

function createMockReply(): FastifyReply {
  return {
    code: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  } as unknown as FastifyReply
}

describe('verifyJwtOptional', () => {
  it('deve chamar jwtVerify e continuar quando token é válido', async () => {
    const request = createMockRequest('success')
    const reply = createMockReply()

    await verifyJwtOptional(request, reply)

    expect(request.jwtVerify).toHaveBeenCalledOnce()
    expect(reply.code).not.toHaveBeenCalled()
    expect(reply.send).not.toHaveBeenCalled()
  })

  it('não deve retornar erro 401 quando token é inválido', async () => {
    const request = createMockRequest('failure')
    const reply = createMockReply()

    await verifyJwtOptional(request, reply)

    expect(request.jwtVerify).toHaveBeenCalledOnce()
    expect(reply.code).not.toHaveBeenCalled()
    expect(reply.send).not.toHaveBeenCalled()
  })

  it('não deve retornar erro 401 quando token está ausente', async () => {
    const request = createMockRequest('failure')
    const reply = createMockReply()

    await expect(verifyJwtOptional(request, reply)).resolves.toBeUndefined()
    expect(reply.code).not.toHaveBeenCalled()
  })
})
