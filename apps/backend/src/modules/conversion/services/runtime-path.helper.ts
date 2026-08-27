import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { env } from '../../../shared/config/env'

/**
 * Resolve o caminho raiz do runtime embutido (`MI_EMBEDDED_RUNTIME_PATH`):
 *  1. `explicitPath` (se passado diretamente pelo caller);
 *  2. `env.MI_EMBEDDED_RUNTIME_PATH` (configurado via .env ou processo pai);
 *  3. Fallback automático no monorepo / layout desktop caso os binários existam.
 */
export function resolveEmbeddedRuntimePath(explicitPath?: string): string {
  if (explicitPath) return explicitPath
  if (env.MI_EMBEDDED_RUNTIME_PATH) return env.MI_EMBEDDED_RUNTIME_PATH

  const candidates = [
    resolve(process.cwd(), '../desktop/resources/runtime'),
    resolve(process.cwd(), 'apps/desktop/resources/runtime'),
    resolve(process.cwd(), 'resources/runtime'),
    resolve(process.cwd(), 'runtime'),
  ]

  for (const candidate of candidates) {
    if (
      existsSync(join(candidate, 'python', 'python.exe')) ||
      existsSync(join(candidate, 'extract_mobi.py'))
    ) {
      return candidate
    }
  }

  return candidates[0]
}
