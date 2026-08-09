export interface ResolveEmbeddedModeOptions {
  isPackaged: boolean
  envFlag?: string
}

/**
 * Decide se o app desktop roda em modo embedded (Postgres + runtime embarcados,
 * sem Docker/Node/Redis no host) ou usa a infraestrutura do host.
 *
 * - `envFlag === '1'` → embedded (override explícito: dev forçado ou produção).
 * - `envFlag === '0'` → host infra (override explícito, inclusive packaged — debug com Docker).
 * - sem flag → embedded em produção (packaged), host infra em dev.
 */
export function resolveEmbeddedMode(opts: ResolveEmbeddedModeOptions): boolean {
  if (opts.envFlag === '1') return true
  if (opts.envFlag === '0') return false
  return opts.isPackaged
}
