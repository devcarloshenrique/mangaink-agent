import dns from 'node:dns'
import { promisify } from 'node:util'
import { isIP } from 'node:net'
import type { InternalAxiosRequestConfig } from 'axios'

const lookup = promisify(dns.lookup)

/**
 * Erro lançado quando uma URL é bloqueada pelo guard de SSRF (VULN-3/MEC-67).
 */
export class SsrfBlockedError extends Error {
  readonly code = 'SSRF_BLOCKED'
  constructor(url: string, reason: string) {
    super(`URL bloqueada pelo guard de SSRF (${reason}): ${url}`)
    this.name = 'SsrfBlockedError'
  }
}

export interface SsrfGuardOptions {
  /** Hosts permitidos explicitamente (ex.: allowedDomains do provider). */
  allowedHosts?: string[]
  /** Bloqueia também redes reservadas/documentação (RFC 5737, 6666, etc.). */
  strict?: boolean
}

const IPV4_PRIVATE = [/^10\./, /^127\./, /^169\.254\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./]
const IPV4_SPECIAL = [/^0\./, /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, /^192\.0\.0\./, /^198\.18\./, /^198\.19\./, /^192\.0\.2\./, /^198\.51\.100\./, /^203\.0\.113\./, /^224\./, /^240\./, /^255\.255\.255\.255/]

function isPrivateIPv4(ip: string): boolean {
  return IPV4_PRIVATE.some((re) => re.test(ip)) || IPV4_SPECIAL.some((re) => re.test(ip))
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase()
  // ::1 loopback, fe80::/10 link-local, fc00::/7 unique-local, ::ffff: IPv4-mapped,
  // ::1/128, 2001:db8::/32 doc, fec0::/10 site-local (deprecated), ff00::/8 multicast.
  if (lower === '::' || lower === '::1') return true
  if (lower.startsWith('fe80') || lower.startsWith('fc') || lower.startsWith('fd')) return true
  if (lower.startsWith('::ffff:')) {
    const v4 = lower.substring('::ffff:'.length)
    return isPrivateIPv4(v4)
  }
  if (lower.startsWith('2001:db8')) return true
  if (lower.startsWith('fec0') || lower.startsWith('ff')) return true
  return false
}

function isPrivateIp(ip: string): boolean {
  const version = isIP(ip)
  if (version === 4) return isPrivateIPv4(ip)
  if (version === 6) return isPrivateIPv6(ip)
  // Se não é IP, trata como hostname — resolve depois.
  return false
}

async function resolveHost(host: string): Promise<string[]> {
  try {
    const { address } = await lookup(host, { all: false })
    return [address]
  } catch {
    return []
  }
}

/**
 * Valida se a URL pode ser acessada (bloqueia SSRF): protocolo http/https,
 * host permitido e endereços privados/loopback/link-local/metadata/reservados.
 */
export async function assertUrlAllowed(url: string, options: SsrfGuardOptions = {}): Promise<void> {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new SsrfBlockedError(url, 'URL inválida')
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new SsrfBlockedError(url, 'protocolo não-http(s)')
  }

  const hostname = parsed.hostname
  if (options.allowedHosts && options.allowedHosts.length > 0) {
    const allow = options.allowedHosts.some(
      (h) => h.toLowerCase() === hostname.toLowerCase() || hostname.toLowerCase().endsWith(`.${h.toLowerCase()}`),
    )
    if (!allow) {
      throw new SsrfBlockedError(url, 'host não permitido')
    }
  }

  // Se já é um IP, valida direto. Senão resolve DNS e valida cada endereço.
  if (isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      throw new SsrfBlockedError(url, 'endereço privado/loopback/link-local/metadata')
    }
    return
  }

  const addresses = await resolveHost(hostname)
  if (addresses.length === 0) {
    // Não resolveu: deixa passar para o fetch tratar (DNS do sistema), mas em
    // modo strict rejeita (evita dependência de DNS rebinding em impls simples).
    if (options.strict) {
      throw new SsrfBlockedError(url, 'falha ao resolver DNS')
    }
    return
  }

  for (const addr of addresses) {
    if (isPrivateIp(addr)) {
      throw new SsrfBlockedError(url, `endereço privado/loopback/link-local/metadata (${addr})`)
    }
  }
}

/**
 * Cria um interceptor de request do axios que valida a URL antes de despachar.
 */
export function createSsrfRequestInterceptor(allowedHosts?: string[], strict = false) {
  return async (config: InternalAxiosRequestConfig) => {
    const target = config.baseURL && config.url && !config.url.startsWith('http')
      ? new URL(config.url, config.baseURL).toString()
      : (config.url ?? '')
    if (target) {
      await assertUrlAllowed(target, { allowedHosts, strict })
    }
    return config
  }
}

/**
 * Remove headers sensíveis (Authorization/Cookie) ao fazer redirect cross-origin.
 */
export function stripSensitiveHeadersForCrossOrigin(
  headers: Record<string, unknown> | undefined,
  from: string,
  to: string,
): void {
  let fromHost: string
  let toHost: string
  try {
    fromHost = new URL(from).hostname
    toHost = new URL(to).hostname
  } catch {
    return
  }
  if (fromHost !== toHost && headers) {
    delete headers['Authorization']
    delete headers['authorization']
    delete headers['Cookie']
    delete headers['cookie']
  }
}
