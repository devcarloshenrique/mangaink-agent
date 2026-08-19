import type { FastifyReply } from 'fastify'
import { env } from '../../../shared/config/env'
import { SESSION_EXPIRES_IN } from './token.service'

/**
 * Cookie de sessão JWT (VULN-10 / MEC-86).
 *
 * O token deixa de ser persistido em localStorage pelo frontend e passa a ser
 * entregue em um cookie httpOnly + SameSite. Decisões registradas:
 *
 * - `httpOnly: true` → JS do navegador não lê o token (mitiga XSS).
 * - `sameSite: 'lax'` → protege contra CSRF em mutações cross-site mantendo
 *   compatibilidade com navegação por link/GET.
 * - `secure` → apenas em produção (HTTPS). Em dev/test o backend roda em
 *   http://localhost, onde cookies Secure não seriam enviados.
 * - `maxAge` → alinhado ao `expiresIn` da sessão JWT (VULN-4: SESSION_EXPIRES_IN).
 */
export const AUTH_COOKIE_NAME = 'mangaink_token'

const SESSION_MAX_AGE_SECONDS = 7 * 60 * 60 // 7h — alinhado a SESSION_EXPIRES_IN

/** Define o cookie httpOnly+SameSite=Lax com o token de sessão. */
export function setAuthCookie(reply: FastifyReply, token: string): void {
  reply.setCookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  })
}

/** Remove o cookie de sessão (logout). */
export function clearAuthCookie(reply: FastifyReply): void {
  reply.clearCookie(AUTH_COOKIE_NAME, { path: '/' })
}

export { SESSION_EXPIRES_IN }
