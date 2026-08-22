import { env } from '../../../shared/config/env'
import type { ConversionEventsService } from './conversion-events.service'
import { KccRunnerEmbedded } from './kcc-runner-embedded.service'
import { KccRunnerService, type IKccRunner } from './kcc-runner.service'
import { resolveEmbeddedRuntimePath } from './runtime-path.helper'

/**
 * Fábrica do runner KCC: escolhe a implementação conforme `env.MI_EMBEDDED_MODE`.
 *  - embedded: `KccRunnerEmbedded` (python embutido, sem Docker)
 *  - web: `KccRunnerService` (`docker run mangaink-kcc:10.3.0`)
 *
 * `runtimePath` explícito sobrepõe `env.MI_EMBEDDED_RUNTIME_PATH` e o fallback
 * automático do monorepo; em modo web é ignorado.
 */
export function createKccRunner(events: ConversionEventsService, runtimePath?: string): IKccRunner {
  if (env.MI_EMBEDDED_MODE) {
    return new KccRunnerEmbedded({
      events,
      runtimePath: resolveEmbeddedRuntimePath(runtimePath),
    })
  }
  return new KccRunnerService(events)
}
