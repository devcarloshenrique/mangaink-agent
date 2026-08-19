import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import rateLimit from '@fastify/rate-limit'
import { register } from './controllers/register.controller'
import { login } from './controllers/login.controller'
import { logout } from './controllers/logout.controller'
import { me } from './controllers/me.controller'
import { updateMe } from './controllers/update-me.controller'
import { registerBodySchema } from './dtos/register.dto'
import { loginSchema } from './dtos/login.dto'
import { updateMeSchema } from './dtos/update-me.dto'
import { verifyJwt } from '../../shared/middlewares/verify-jwt'

const publicUserSchema = z.object({
  id: z.string(),
  username: z.string(),
  email: z.string(),
  role: z.enum(['USER', 'ADMIN']).default('USER').optional(),
  kindleEmail: z.string().nullable(),
  avatarUrl: z.string().nullable(),
})

export const authRoutes: FastifyPluginAsyncZod = async (app) => {
  // Rate limit por rota (escopo local): nunca global. Baseado em IP.
  await app.register(rateLimit, { global: false })

  // POST /auth/register
  app.post(
    '/auth/register',
    {
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
      schema: {
        tags: ['Auth'],
        summary: 'Cadastra um novo usuário',
        description: 'Cria uma nova conta com username, e-mail e senha. Retorna o token JWT e dados do usuário.',
        body: registerBodySchema,
        response: {
          201: z.object({ user: publicUserSchema, token: z.string() }),
          400: z.object({ error: z.string(), issues: z.any().optional() }),
          409: z.object({ error: z.string() }),
          429: z.object({ error: z.string() }),
        },
      },
    },
    register,
  )

  // POST /auth/login
  app.post(
    '/auth/login',
    {
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      schema: {
        tags: ['Auth'],
        summary: 'Login com e-mail e senha',
        description: 'Autentica o usuário e retorna um token JWT para uso nos endpoints protegidos.',
        body: loginSchema,
        response: {
          200: z.object({ user: publicUserSchema, token: z.string() }),
          401: z.object({ error: z.string() }),
          429: z.object({ error: z.string() }),
        },
      },
    },
    login,
  )

  // POST /auth/logout
  app.post(
    '/auth/logout',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Logout — revoga o token de sessão',
        description: 'Marca o jti do token atual na denylist server-side, invalidando-o imediatamente (VULN-4).',
        security: [{ bearerAuth: [] }],
        response: {
          204: z.object({}).nullable(),
          401: z.object({ error: z.string() }),
        },
      },
      onRequest: [verifyJwt],
    },
    logout,
  )

  // GET /auth/me
  app.get(
    '/auth/me',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Dados do usuário autenticado',
        description: 'Retorna o perfil completo do usuário atualmente autenticado via token JWT.',
        security: [{ bearerAuth: [] }],
        response: {
          200: publicUserSchema,
          401: z.object({ error: z.string() }),
        },
      },
      onRequest: [verifyJwt],
    },
    me,
  )

  // PATCH /users/me
  app.patch(
    '/users/me',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Atualiza dados do usuário',
        description: 'Atualiza username, e-mail, kindleEmail ou avatarUrl do usuário autenticado.',
        security: [{ bearerAuth: [] }],
        body: updateMeSchema,
        response: {
          200: publicUserSchema,
          400: z.object({ error: z.string(), issues: z.any().optional() }),
          401: z.object({ error: z.string() }),
          409: z.object({ error: z.string() }),
        },
      },
      onRequest: [verifyJwt],
    },
    updateMe,
  )
}
