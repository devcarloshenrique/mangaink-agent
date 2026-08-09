import { afterEach, describe, expect, it, vi } from 'vitest'

type RunnerWithDeps = { deps: { runtimePath: string } }

describe('createMobiUnpackRunner', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('MI_EMBEDDED_MODE=1 → devolve MobiUnpackRunnerEmbedded com runtimePath do env', async () => {
    vi.stubEnv('MI_EMBEDDED_MODE', '1')
    vi.stubEnv('MI_EMBEDDED_RUNTIME_PATH', 'C:\\embedded\\runtime')
    vi.resetModules()

    const { createMobiUnpackRunner } = await import('../../services/mobi-unpack-runner.factory')
    const { MobiUnpackRunnerEmbedded } = await import('../../services/mobi-unpack-runner-embedded.service')

    const runner = createMobiUnpackRunner()
    expect(runner).toBeInstanceOf(MobiUnpackRunnerEmbedded)
    expect((runner as unknown as RunnerWithDeps).deps.runtimePath).toBe('C:\\embedded\\runtime')
  })

  it('sem flag (modo web) → devolve MobiUnpackRunnerService', async () => {
    vi.stubEnv('MI_EMBEDDED_MODE', '0')
    vi.resetModules()

    const { createMobiUnpackRunner } = await import('../../services/mobi-unpack-runner.factory')
    const { MobiUnpackRunnerService } = await import('../../services/mobi-unpack-runner.service')

    const runner = createMobiUnpackRunner()
    expect(runner).toBeInstanceOf(MobiUnpackRunnerService)
  })

  it('runtimePath explícito sobrepõe o env no modo embedded', async () => {
    vi.stubEnv('MI_EMBEDDED_MODE', '1')
    vi.stubEnv('MI_EMBEDDED_RUNTIME_PATH', 'C:\\env\\runtime')
    vi.resetModules()

    const { createMobiUnpackRunner } = await import('../../services/mobi-unpack-runner.factory')
    const { MobiUnpackRunnerEmbedded } = await import('../../services/mobi-unpack-runner-embedded.service')

    const runner = createMobiUnpackRunner('C:\\explicit\\runtime')
    expect(runner).toBeInstanceOf(MobiUnpackRunnerEmbedded)
    expect((runner as unknown as RunnerWithDeps).deps.runtimePath).toBe('C:\\explicit\\runtime')
  })
})
