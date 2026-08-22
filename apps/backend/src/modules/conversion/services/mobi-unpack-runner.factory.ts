import { env } from '../../../shared/config/env'
import { MobiUnpackRunnerEmbedded } from './mobi-unpack-runner-embedded.service'
import { MobiUnpackRunnerService, type MobiUnpackRunner } from './mobi-unpack-runner.service'
import { resolveEmbeddedRuntimePath } from './runtime-path.helper'

/**
 * Fábrica do runner de extração MOBI: escolhe a implementação conforme
 * `env.MI_EMBEDDED_MODE`.
 *  - embedded: `MobiUnpackRunnerEmbedded` (python embutido, sem Docker)
 *  - web: `MobiUnpackRunnerService` (`docker run mangaink-unpack:0.4.1`)
 *
 * `runtimePath` explícito sobrepõe `env.MI_EMBEDDED_RUNTIME_PATH` e o fallback
 * automático do monorepo; em modo web é ignorado.
 */
export function createMobiUnpackRunner(runtimePath?: string): MobiUnpackRunner {
  if (env.MI_EMBEDDED_MODE) {
    return new MobiUnpackRunnerEmbedded({
      runtimePath: resolveEmbeddedRuntimePath(runtimePath),
    })
  }
  return new MobiUnpackRunnerService()
}
