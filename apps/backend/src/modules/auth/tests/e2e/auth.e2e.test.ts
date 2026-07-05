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
  payload = { email: 'test@example.com', password: 'senha1234' },
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
      email: 'test@example.com',
      password: 'senhaerrada',
    })

    expect(response.statusCode).toBe(401)
    expect(response.json()).toHaveProperty('error')
  })

  it('POST /auth/login → 401 com e-mail inexistente', async () => {
    const response = await loginUser(app, {
      email: 'naoexiste@example.com',
      password: 'qualquer',
    })

    expect(response.statusCode).toBe(401)
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
