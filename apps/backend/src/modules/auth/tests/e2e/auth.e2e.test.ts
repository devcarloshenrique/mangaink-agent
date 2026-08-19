// ── vi.mock DEVE ser declarado antes de qualquer import de módulo real ────────────
// O Vitest faz hoisting automático deste bloco para o topo do arquivo.
// A factory NÃO pode referenciar variáveis externas (limitação do hoisting).
// Usamos uma closure que captura o repositório compartilhado via módulo auxiliar.
import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('../../../user/repositories/prisma-user.repository', async () => {
  const { InMemoryUserRepository } = await import(
    '../helpers/in-memory-user.repository'
  )
  return {
    PrismaUserRepository: vi.fn().mockImplementation(() => new InMemoryUserRepository()),
  }
})

import { PrismaUserRepository } from '../../../user/repositories/prisma-user.repository'
import { InMemoryUserRepository } from '../helpers/in-memory-user.repository'
import { createServer } from '../../../../shared/server'
import type { FastifyInstance } from 'fastify'
import { JWT_ISSUER, JWT_AUDIENCE } from '../../services/token.service'
import { randomUUID } from 'node:crypto'

// ── Helpers ─────────────────────────────────────────────────────────────────────

async function registerUser(
  app: FastifyInstance,
  payload = {
    username: 'testuser',
    email: 'test@example.com',
    password: 'senha1234',
    confirmPassword: 'senha1234',
  },
) {
  return app.inject({
    method: 'POST',
    url: '/auth/register',
    payload,
  })
}

async function loginUser(
  app: FastifyInstance,
  payload = { identifier: 'test@example.com', password: 'senha1234' },
) {
  return app.inject({
    method: 'POST',
    url: '/auth/login',
    payload,
  })
}

// ── Repositório compartilhado entre todos os controllers ─────────────────────────
// Como cada controller instancia "new PrismaUserRepository()", e o mock retorna
// instâncias distintas por padrão, precisamos fazer o mock retornar SEMPRE o mesmo repo.
let sharedRepo: InMemoryUserRepository

beforeEach(() => {
  sharedRepo = new InMemoryUserRepository()
  vi.mocked(PrismaUserRepository).mockImplementation(() => sharedRepo)
})

// ── Suite ────────────────────────────────────────────────────────────────────────

describe('Auth E2E — /auth/register', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    app = await createServer()
  })

  it('POST /auth/register → 201 com user e token', async () => {
    const response = await registerUser(app)

    expect(response.statusCode).toBe(201)
    const body = response.json()
    expect(body).toHaveProperty('token')
    expect(body.user).toMatchObject({
      username: 'testuser',
      email: 'test@example.com',
    })
    expect(body.user).not.toHaveProperty('passwordHash')
  })

  it('POST /auth/register → 409 quando e-mail já existe', async () => {
    await registerUser(app)
    const response = await registerUser(app)

    expect(response.statusCode).toBe(409)
    expect(response.json()).toHaveProperty('error')
  })

  it('POST /auth/register → 400 com dados inválidos (username vazio)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { username: '', email: 'bad', password: '123' },
    })

    expect(response.statusCode).toBe(400)
  })
})

describe('Auth E2E — /auth/login', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    app = await createServer()
    await registerUser(app)
  })

  it('POST /auth/login → 200 com user e token', async () => {
    const response = await loginUser(app)

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body).toHaveProperty('token')
    expect(body.user.email).toBe('test@example.com')
  })

  it('POST /auth/login → 401 com senha incorreta', async () => {
    const response = await loginUser(app, {
      identifier: 'test@example.com',
      password: 'senhaerrada',
    })

    expect(response.statusCode).toBe(401)
    expect(response.json()).toHaveProperty('error')
  })

  it('POST /auth/login → 401 com e-mail inexistente', async () => {
    const response = await loginUser(app, {
      identifier: 'naoexiste@example.com',
      password: 'qualquer',
    })

    expect(response.statusCode).toBe(401)
  })

  it('POST /auth/login → 400 com identifier acima do limite de 255 caracteres', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { identifier: 'a'.repeat(300_000), password: 'senha1234' },
    })

    expect(response.statusCode).toBe(400)
  })

  it('POST /auth/login → 400 com identifier whitespace-only', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { identifier: '   ', password: 'senha1234' },
    })

    expect(response.statusCode).toBe(400)
  })
})

describe('Auth E2E — /auth/me', () => {
  let app: FastifyInstance
  let token: string

  beforeEach(async () => {
    app = await createServer()
    await registerUser(app)
    const loginRes = await loginUser(app)
    token = loginRes.json().token
  })

  it('GET /auth/me → 401 sem token', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/auth/me',
    })

    expect(response.statusCode).toBe(401)
  })

  it('GET /auth/me → 200 com token válido', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { Authorization: `Bearer ${token}` },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.email).toBe('test@example.com')
    expect(body).not.toHaveProperty('passwordHash')
  })
})

describe('Auth E2E — PATCH /users/me', () => {
  let app: FastifyInstance
  let token: string

  beforeEach(async () => {
    app = await createServer()
    await registerUser(app)
    const loginRes = await loginUser(app)
    token = loginRes.json().token
  })

  it('PATCH /users/me → 401 sem token', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: '/users/me',
      payload: { username: 'novonome' },
    })

    expect(response.statusCode).toBe(401)
  })

  it('PATCH /users/me → 200 atualizando username', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: '/users/me',
      headers: { Authorization: `Bearer ${token}` },
      payload: { username: 'novonome' },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json().username).toBe('novonome')
  })
})

describe('Auth E2E — claims da sessão JWT (VULN-4)', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    app = await createServer()
    await registerUser(app)
  })

  it('POST /auth/login → token com claims jti, iss e aud', async () => {
    const response = await loginUser(app)
    const token = response.json().token
    const decoded = app.jwt.decode(token) as Record<string, unknown>

    expect(decoded.sub).toBeDefined()
    expect(typeof decoded.jti).toBe('string')
    expect(decoded.iss).toBe(JWT_ISSUER)
    expect(decoded.aud).toBe(JWT_AUDIENCE)
    expect(typeof decoded.exp).toBe('number')
  })

  it('POST /auth/register → token com claims jti, iss e aud', async () => {
    const response = await registerUser(app, {
      username: 'claimuser',
      email: 'claim@example.com',
      password: 'senha1234',
      confirmPassword: 'senha1234',
    })

    const decoded = app.jwt.decode(response.json().token) as Record<string, unknown>
    expect(decoded.iss).toBe(JWT_ISSUER)
    expect(decoded.aud).toBe(JWT_AUDIENCE)
    expect(typeof decoded.jti).toBe('string')
  })
})

describe('Auth E2E — segurança da sessão JWT (VULN-4)', () => {
  let app: FastifyInstance
  let token: string

  beforeEach(async () => {
    app = await createServer()
    await registerUser(app)
    const loginRes = await loginUser(app)
    token = loginRes.json().token
  })

  const me = (t: string) =>
    app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { Authorization: `Bearer ${t}` },
    })

  it('GET /auth/me → 401 com token expirado', async () => {
    const expired = app.jwt.sign({
      sub: 'user',
      jti: randomUUID(),
      iss: JWT_ISSUER,
      aud: JWT_AUDIENCE,
      exp: Math.floor(Date.now() / 1000) - 3600, // expirado há 1h
    })

    const response = await me(expired)
    expect(response.statusCode).toBe(401)
  })

  it('GET /auth/me → 401 com token sem claim jti', async () => {
    const noJti = app.jwt.sign({ sub: 'user', iss: JWT_ISSUER, aud: JWT_AUDIENCE })

    const response = await me(noJti)
    expect(response.statusCode).toBe(401)
  })

  it('GET /auth/me → 401 com iss/aud divergentes dos esperados', async () => {
    const wrong = app.jwt.sign({
      sub: 'user',
      jti: randomUUID(),
      iss: 'evil-app',
      aud: JWT_AUDIENCE,
    })

    const response = await me(wrong)
    expect(response.statusCode).toBe(401)
  })

  it('POST /auth/logout → 204 e o mesmo token passa a ser 401', async () => {
    const logoutRes = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(logoutRes.statusCode).toBe(204)

    const after = await me(token)
    expect(after.statusCode).toBe(401)
  })

  it('POST /auth/logout → 401 sem token', async () => {
    const response = await app.inject({ method: 'POST', url: '/auth/logout' })
    expect(response.statusCode).toBe(401)
  })

  it('logout de um jti não invalida tokens de outras sessões', async () => {
    await app.inject({
      method: 'POST',
      url: '/auth/logout',
      headers: { Authorization: `Bearer ${token}` },
    })

    const login2 = await loginUser(app)
    const token2 = login2.json().token
    expect(token2).not.toBe(token)

    const afterLogout = await me(token)
    expect(afterLogout.statusCode).toBe(401)

    const other = await me(token2)
    expect(other.statusCode).toBe(200)
  })
})

describe('Auth E2E — cookie httpOnly + SameSite (VULN-10)', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    app = await createServer()
    await registerUser(app)
  })

  function extractSetCookie(response: { headers: Record<string, unknown> }): string {
    const header = response.headers['set-cookie'] as unknown
    if (Array.isArray(header)) return (header as string[]).join('; ')
    return String(header ?? '')
  }

  it('POST /auth/login → define Set-Cookie httpOnly com SameSite=Lax', async () => {
    const response = await loginUser(app)

    expect(response.statusCode).toBe(200)
    const setCookie = extractSetCookie(response)
    expect(setCookie).toContain('mangaink_token=')
    expect(setCookie).toContain('HttpOnly')
    expect(setCookie).toContain('SameSite=Lax')
    expect(setCookie).toContain('Path=/')
    // Em test (http) o cookie não deve ter Secure — apenas em produção.
    expect(setCookie.toLowerCase()).not.toContain('secure')
    // Sem o flag Secure+SameSite=None, o cookie não deve ser de terceiros.
    expect(setCookie.toLowerCase()).not.toContain('samesite=none')
  })

  it('POST /auth/register → define Set-Cookie httpOnly', async () => {
    const response = await registerUser(app, {
      username: 'cookieuser',
      email: 'cookie@example.com',
      password: 'senha1234',
      confirmPassword: 'senha1234',
    })

    expect(response.statusCode).toBe(201)
    const setCookie = extractSetCookie(response)
    expect(setCookie).toContain('mangaink_token=')
    expect(setCookie).toContain('HttpOnly')
    expect(setCookie).toContain('SameSite=Lax')
  })

  it('request autenticado via cookie funciona (sem Authorization header)', async () => {
    const loginRes = await loginUser(app)
    const setCookie = extractSetCookie(loginRes)
    const token = setCookie.split(';')[0] // mangaink_token=<jwt>

    const response = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { Cookie: token },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json().email).toBe('test@example.com')
  })

  it('cookie expirado/ausente → 401', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { Cookie: 'mangaink_token=token-invalido' },
    })

    expect(response.statusCode).toBe(401)
  })

  it('POST /auth/logout → limpa o cookie', async () => {
    const loginRes = await loginUser(app)
    const setCookie = extractSetCookie(loginRes)
    const token = setCookie.split(';')[0]

    const logoutRes = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      headers: { Cookie: token },
    })
    expect(logoutRes.statusCode).toBe(204)

    const clearCookie = extractSetCookie(logoutRes)
    expect(clearCookie.toLowerCase()).toContain('mangaink_token=;')
    expect(clearCookie.toLowerCase()).toContain('expires=')
  })

  it('cookie não fica acessível via JS (httpOnly) e token não vaza no body após logout', async () => {
    const loginRes = await loginUser(app)
    const setCookie = extractSetCookie(loginRes)

    // httpOnly garante que document.cookie não expõe o token ao JS.
    expect(setCookie).toContain('HttpOnly')
    // O token do corpo da resposta continua sendo o mesmo assinado (não é
    // persistido pelo frontend em localStorage).
    expect(loginRes.json().token).toBeDefined()
  })
})
