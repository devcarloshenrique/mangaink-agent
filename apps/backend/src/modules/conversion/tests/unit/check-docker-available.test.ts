import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const execSyncMock = vi.hoisted(() => vi.fn())

vi.mock('node:child_process', () => ({
  execSync: execSyncMock,
  spawn: vi.fn(),
}))

describe('checkDockerAvailable — no-op no modo embedded', () => {
  beforeEach(() => {
    execSyncMock.mockReset()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('MI_EMBEDDED_MODE=1 → NÃO executa execSync("docker --version")', async () => {
    vi.stubEnv('MI_EMBEDDED_MODE', '1')
    vi.resetModules()

    const { checkDockerAvailable } = await import('../../services/kcc-runner.service')
    checkDockerAvailable()
    expect(execSyncMock).not.toHaveBeenCalled()
  })

  it('sem flag (modo web) → executa execSync("docker --version")', async () => {
    vi.stubEnv('MI_EMBEDDED_MODE', '0')
    vi.resetModules()

    const { checkDockerAvailable } = await import('../../services/kcc-runner.service')
    checkDockerAvailable()
    expect(execSyncMock).toHaveBeenCalledWith('docker --version', expect.objectContaining({ stdio: 'ignore' }))
  })
})
