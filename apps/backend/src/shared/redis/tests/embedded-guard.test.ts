import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('ioredis', () => {
  const MockRedis = vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    status: 'ready',
    quit: vi.fn().mockResolvedValue(undefined),
  }))
  return { default: MockRedis }
})

/**
 * Guard de modo embedded: o backend embarcado no desktop não tem Redis
 * disponível. `createSafeRedis` e `getRedis` devem lançar erro claro com
 * `MI_EMBEDDED_MODE=1` e NÃO lançar no modo web.
 */
describe('embedded-guard: Redis bloqueado no modo embedded', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('createSafeRedis() lança erro claro com MI_EMBEDDED_MODE=1', async () => {
    vi.stubEnv('MI_EMBEDDED_MODE', '1')
    vi.resetModules()

    const { createSafeRedis } = await import('../safe-redis')
    expect(() => createSafeRedis('test')).toThrow(/Redis não disponível no modo embedded/)
  })

  it('getRedis() lança erro claro com MI_EMBEDDED_MODE=1', async () => {
    vi.stubEnv('MI_EMBEDDED_MODE', '1')
    vi.resetModules()

    const { getRedis } = await import('../redis')
    expect(() => getRedis()).toThrow(/Redis não disponível no modo embedded/)
  })

  it('createSafeRedis() NÃO lança sem a flag (modo web)', async () => {
    vi.stubEnv('MI_EMBEDDED_MODE', '0')
    vi.resetModules()

    const { createSafeRedis, closeAllRedisConnections } = await import('../safe-redis')
    const instance = createSafeRedis('test-web')
    expect(instance).toBeDefined()
    await closeAllRedisConnections()
  })

  it('getRedis() NÃO lança sem a flag (modo web)', async () => {
    vi.stubEnv('MI_EMBEDDED_MODE', '0')
    vi.resetModules()

    const { getRedis, closeRedis } = await import('../redis')
    const instance = getRedis()
    expect(instance).toBeDefined()
    await closeRedis()
  })
})
