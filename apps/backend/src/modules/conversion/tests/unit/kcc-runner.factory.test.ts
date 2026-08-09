import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ConversionEventsService } from '../../services/conversion-events.service'

const mockEvents = {
  createEvent: vi.fn(),
  emit: vi.fn(),
} as unknown as ConversionEventsService

type RunnerWithDeps = { deps: { runtimePath: string } }

describe('createKccRunner', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('MI_EMBEDDED_MODE=1 → devolve KccRunnerEmbedded com runtimePath do env', async () => {
    vi.stubEnv('MI_EMBEDDED_MODE', '1')
    vi.stubEnv('MI_EMBEDDED_RUNTIME_PATH', 'C:\\embedded\\runtime')
    vi.resetModules()

    const { createKccRunner } = await import('../../services/kcc-runner.factory')
    const { KccRunnerEmbedded } = await import('../../services/kcc-runner-embedded.service')

    const runner = createKccRunner(mockEvents)
    expect(runner).toBeInstanceOf(KccRunnerEmbedded)
    expect((runner as unknown as RunnerWithDeps).deps.runtimePath).toBe('C:\\embedded\\runtime')
  })

  it('sem flag (modo web) → devolve KccRunnerService', async () => {
    vi.stubEnv('MI_EMBEDDED_MODE', '0')
    vi.resetModules()

    const { createKccRunner } = await import('../../services/kcc-runner.factory')
    const { KccRunnerService } = await import('../../services/kcc-runner.service')

    const runner = createKccRunner(mockEvents)
    expect(runner).toBeInstanceOf(KccRunnerService)
  })

  it('runtimePath explícito sobrepõe o env no modo embedded', async () => {
    vi.stubEnv('MI_EMBEDDED_MODE', '1')
    vi.stubEnv('MI_EMBEDDED_RUNTIME_PATH', 'C:\\env\\runtime')
    vi.resetModules()

    const { createKccRunner } = await import('../../services/kcc-runner.factory')
    const { KccRunnerEmbedded } = await import('../../services/kcc-runner-embedded.service')

    const runner = createKccRunner(mockEvents, 'C:\\explicit\\runtime')
    expect(runner).toBeInstanceOf(KccRunnerEmbedded)
    expect((runner as unknown as RunnerWithDeps).deps.runtimePath).toBe('C:\\explicit\\runtime')
  })
})
