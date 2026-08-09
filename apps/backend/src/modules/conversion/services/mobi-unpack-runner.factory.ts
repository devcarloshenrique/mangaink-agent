import { env } from '../../../shared/config/env'
import { MobiUnpackRunnerEmbedded } from './mobi-unpack-runner-embedded.service'
import { MobiUnpackRunnerService, type MobiUnpackRunner } from './mobi-unpack-runner.service'

/**
 * Fábrica do runner de extração MOBI: escolhe a implementação conforme
 * `env.MI_EMBEDDED_MODE`.
 *  - embedded: `MobiUnpackRunnerEmbedded` (python embutido, sem Docker)
 *  - web: `MobiUnpackRunnerService` (`docker run mangaink-unpack:0.4.1`)
 *
 * `runtimePath` explícito sobrepõe `env.MI_EMBEDDED_RUNTIME_PATH`; em modo web
 * é ignorado. O runner embedded valida runtimePath vazio com erro claro no `run`.
 */
export function createMobiUnpackRunner(runtimePath?: string): MobiUnpackRunner {
  if (env.MI_EMBEDDED_MODE) {
    return new MobiUnpackRunnerEmbedded({
      runtimePath: runtimePath ?? env.MI_EMBEDDED_RUNTIME_PATH ?? '',
    })
  }
  return new MobiUnpackRunnerService()
}
