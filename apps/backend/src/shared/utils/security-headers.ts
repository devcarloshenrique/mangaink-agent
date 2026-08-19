/**
 * Headers de segurança globais (VULN-9/MEC-85) aplicados via @fastify/helmet.
 *
 * COEP está deliberadamente desligado: `require-corp` bloquearia sub-recursos
 * cross-origin no-cors e pode quebrar streaming/SSE — não é exigido pelo achado.
 */

import type { FastifyHelmetOptions } from '@fastify/helmet'

/**
 * Headers de segurança para respostas SSE/streaming. Como os fluxos SSE
 * escrevem direto no `reply.raw` (hijack), não passam pelo `onSend` do helmet
 * — estes headers são reaplicados manualmente em cada serviço SSE (VULN-9).
 */
export const sseSecurityHeaders: Record<string, string> = {
  'Content-Security-Policy': "default-src 'self';frame-ancestors 'self'",
  'X-Frame-Options': 'SAMEORIGIN',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-site',
  'X-DNS-Prefetch-Control': 'off',
  'X-Download-Options': 'noopen',
  'X-Permitted-Cross-Domain-Policies': 'none',
}

export function applySseSecurityHeaders(raw: { setHeader?: (name: string, value: string) => void }): void {
  if (typeof raw?.setHeader === 'function') {
    for (const [name, value] of Object.entries(sseSecurityHeaders)) {
      raw.setHeader(name, value)
    }
  }
}

export const securityHeadersConfig: FastifyHelmetOptions = {
  contentSecurityPolicy: {
    directives: {
      'default-src': ["'self'"],
      'base-uri': ["'self'"],
      'font-src': ["'self'", 'https:', 'data:'],
      'form-action': ["'self'"],
      'frame-ancestors': ["'self'"],
      'img-src': ["'self'", 'data:'],
      'object-src': ["'none'"],
      'script-src': ["'self'"],
      'script-src-attr': ["'none'"],
      'style-src': ["'self'", "'unsafe-inline'"],
      'upgrade-insecure-requests': [],
    },
  },
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  crossOriginResourcePolicy: { policy: 'same-site' },
  referrerPolicy: { policy: 'no-referrer' },
  hsts: { maxAge: 15552000, includeSubDomains: true, preload: true },
  noSniff: true,
  frameguard: { action: 'sameorigin' },
  dnsPrefetchControl: { allow: false },
  permittedCrossDomainPolicies: { permittedPolicies: 'none' },
  hidePoweredBy: true,
  crossOriginEmbedderPolicy: false,
  xssFilter: false,
}
