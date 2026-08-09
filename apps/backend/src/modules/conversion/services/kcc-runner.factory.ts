import { env } from '../../../shared/config/env'
import type { ConversionEventsService } from './conversion-events.service'
import { KccRunnerEmbedded } from './kcc-runner-embedded.service'
import { KccRunnerService, type IKccRunner } from './kcc-runner.service'

/**
 * Fábrica do runner KCC: escolhe a implementação conforme `env.MI_EMBEDDED_MODE`.
 *  - embedded: `KccRunnerEmbedded` (python embutido, sem Docker)
 *  - web: `KccRunnerService` (`docker run mangaink-kcc:10.3.0`)
 *
 * `runtimePath` explícito sobrepõe `env.MI_EMBEDDED_RUNTIME_PATH`; em modo web
 * é ignorado. O runner embedded valida runtimePath vazio com erro claro no `run`.
 */
export function createKccRunner(events: ConversionEventsService, runtimePath?: string): IKccRunner {
  if (env.MI_EMBEDDED_MODE) {
    return new KccRunnerEmbedded({
      events,
      runtimePath: runtimePath ?? env.MI_EMBEDDED_RUNTIME_PATH ?? '',
    })
  }
  return new KccRunnerService(events)
}
