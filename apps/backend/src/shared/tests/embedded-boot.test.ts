import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../redis/safe-redis', () => ({
  createSafeRedis: vi.fn(),
  closeAllRedisConnections: vi.fn(),
}))

/**
 * Boot embedded: `createServer()` em modo embedded (MI_EMBEDDED_MODE=1) deve
 * subir sem nenhuma conexão Redis — produtores (rotas) e consumidores
 * (workers) compartilham as mesmas instâncias via `runtime.*`.
 */
describe('embedded-boot: createServer roda sem Redis', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('health + conversions/options → 200; createSafeRedis nunca chamado', async () => {
    vi.stubEnv('MI_EMBEDDED_MODE', '1')
    vi.resetModules()

    const { createSafeRedis } = await import('../redis/safe-redis')
    const { createServer } = await import('../server')

    vi.mocked(createSafeRedis).mockImplementation(() => {
      throw new Error('Redis tocado durante boot embedded')
    })

    const app = await createServer()

    const health = await app.inject({ method: 'GET', url: '/api/health' })
    expect(health.statusCode).toBe(200)

    const options = await app.inject({ method: 'GET', url: '/api/conversions/options' })
    expect(options.statusCode).toBe(200)

    expect(createSafeRedis).not.toHaveBeenCalled()
  })
})
