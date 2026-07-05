## Why

The current authentication system is fully mocked with a hardcoded user (`admin` / `admin@kindle.com`). The `RequireAuth` guard renders children unconditionally and login accepts any credentials. This is a placeholder that must be replaced with a real authentication system (JWT tokens, secure password hashing, session management) before the app can be used in production or by multiple users.

## What Changes

### Project Restructure
- **BREAKING**: Restructure project into monorepo with `apps/frontend` and `apps/backend` folders
- Frontend: React 19 + TypeScript + Vite 7 + TanStack Router (existing)
- Backend: Node.js + **Fastify** + **Prisma ORM** + **PostgreSQL** (already exists in `../manga-ink/backend`)
- Shared: Types and Zod schemas in `packages/shared` (optional)

### Frontend Changes
- **BREAKING**: Remove `AuthProvider` mock implementation from `src/hooks/useAuth.tsx`
- **BREAKING**: Replace `RequireAuth` component with real auth guard that redirects to `/login`
- **BREAKING**: Replace `/login` page mock with real login form + API integration
- Add JWT token management (access + refresh tokens) with secure HTTP-only cookies
- Add user registration flow (`/cadastro` route already exists)
- Add protected API routes middleware for backend integration
- Add logout functionality with token invalidation
- Add session persistence across browser reloads
- Update `AuthProvider` context type to include real user data, tokens, and auth methods
- API client (`src/lib/api.ts`) with auth interceptors for backend communication

### Backend Changes (Already Implemented in `../manga-ink/backend`)
- ✅ **Fastify server** with modular architecture (modules/use-cases)
- ✅ **PostgreSQL database** with Prisma ORM for user persistence
- ✅ **Docker Compose** configuration for local PostgreSQL development
- ✅ **Auth module** with use-cases: login, register, refresh, logout, me
- ✅ **Unit tests** for use-cases and integration tests for endpoints
- ✅ **E2E tests** for critical auth flows
- ✅ **JWT token generation/validation** with `@fastify/jwt`
- ✅ **Password hashing** with `bcryptjs`
- ✅ **Zod validation schemas** shared with frontend
- ✅ **Swagger/OpenAPI documentation** with `@fastify/swagger` and `@fastify/swagger-ui`
- ✅ **Zod integration with Fastify** via `fastify-type-provider-zod` for type-safe validation and automatic OpenAPI schema generation

### Dependencies (Already in Backend)

**Backend (already installed):**
- `fastify` — Web framework
- `@fastify/jwt` — JWT plugin
- `@fastify/cookie` — Cookie parsing
- `@fastify/cors` — CORS
- `@fastify/helmet` — Security headers
- `@fastify/rate-limit` — Rate limiting
- `@fastify/swagger` — OpenAPI/Swagger documentation generation
- `@fastify/swagger-ui` — Swagger UI for API documentation
- `fastify-type-provider-zod` — Zod integration with Fastify for type-safe validation and auto OpenAPI schema generation
- `prisma` + `@prisma/client` — ORM
- `bcryptjs` — Password hashing
- `zod` — Validation
- `vitest` — Unit testing
- `@vitest/coverage-v8` — Coverage
- `supertest` — E2E API testing

**Dev:**
- `docker-compose` — PostgreSQL service
- `tsx` — TypeScript execution
- `eslint` + `prettier` — Linting/formatting

## Capabilities

### New Capabilities

- `user-auth`: User authentication with email/password, JWT tokens, session management
- `user-registration`: New user account creation with email verification
- `auth-guards`: Route protection and permission-based access control
- `backend-auth-api`: Fastify backend with modular auth endpoints
- `database-persistence`: PostgreSQL + Prisma for user data storage
- `api-documentation`: Swagger/OpenAPI 3.0 documentation with Zod schema auto-generation

### Modified Capabilities

- None (no existing formal specs in this project)

## Impact

### New Project Structure
```
mangaink/
├── apps/
│   ├── frontend/          # React + Vite + TanStack Router (existing code moved here)
│   │   ├── src/
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   └── tsconfig.json
│   └── backend/           # Fastify + Prisma + PostgreSQL (already exists in ../manga-ink/backend)
│       ├── src/
│       │   ├── modules/
│       │   │   └── auth/
│       │   │       ├── controllers/
│       │   │       ├── dtos/
│       │   │       ├── errors/
│       │   │       ├── repositories/
│       │   │       ├── services/
│       │   │       ├── use-cases/
│       │   │       ├── routes/
│       │   │       └── tests/
│       │   │           ├── unit/
│       │   │           └── e2e/
│       │   ├── shared/
│       │   │   ├── middlewares/
│       │   │   ├── prisma/
│       │   │   └── utils/
│       │   ├── app.ts
│       │   └── server.ts
│       ├── prisma/
│       │   └── schema.prisma
│       ├── docker-compose.yml
│       ├── package.json
│       └── tsconfig.json
├── packages/
│   └── shared/            # Shared types, Zod schemas (optional)
├── docker-compose.yml     # Root compose for full stack
├── package.json           # Root workspace config (pnpm)
├── pnpm-workspace.yaml
└── turbo.json             # Turborepo config (optional)
```

### Files to Modify (Frontend)
- `apps/frontend/src/hooks/useAuth.tsx` — Complete rewrite of auth context
- `apps/frontend/src/components/auth/RequireAuth.tsx` — Real auth guard with redirect
- `apps/frontend/src/routes/login.tsx` — Real login form with validation
- `apps/frontend/src/routes/cadastro.tsx` — Real registration form with validation
- `apps/frontend/src/routes/__root.tsx` — Update providers if needed
- `apps/frontend/src/lib/api.ts` (new) — API client with auth interceptors
- `apps/frontend/src/types/auth.ts` (new) — Auth-related TypeScript types

### Backend Files (Already Exist in `../manga-ink/backend`)
- `apps/backend/prisma/schema.prisma` — User model and database schema
- `apps/backend/docker-compose.yml` — PostgreSQL service for local development
- `apps/backend/src/modules/auth/use-cases/*.ts` — Auth use-cases
- `apps/backend/src/modules/auth/repositories/user.repository.ts` — User data access
- `apps/backend/src/modules/auth/routes/auth.routes.ts` — Auth endpoints with Zod validation & OpenAPI
- `apps/backend/src/modules/auth/dtos/*.ts` — Zod validation schemas
- `apps/backend/src/modules/auth/controllers/*.ts` — HTTP controllers
- `apps/backend/src/modules/auth/services/*.ts` — Services (password hasher, token service)
- `apps/backend/src/modules/auth/tests/unit/*.test.ts` — Unit tests
- `apps/backend/src/modules/auth/tests/e2e/*.test.ts` — E2E tests
- `apps/backend/src/shared/prisma/prisma.ts` — Prisma client singleton
- `apps/backend/src/shared/middlewares/verify-jwt.ts` — JWT verification middleware
- `apps/backend/src/app.ts` — Fastify app setup with Swagger, Zod, plugins
- `apps/backend/src/server.ts` — Server entry point

### Routes Affected
- `/login` — Real authentication
- `/cadastro` — Real registration
- All protected routes (`/`, `/biblioteca`, `/wizard`, `/agendamentos`, `/configuracoes`, `/fontes`, `/perfil`) — Enforced auth
- `/api-docs` — Swagger UI documentation (backend)

## OpenAPI/Swagger Integration (Backend)

The backend already implements full OpenAPI 3.0 documentation with automatic schema generation from Zod:

### Swagger Configuration (in `app.ts`)
```typescript
import { jsonSchemaTransform } from 'fastify-type-provider-zod'

await app.register(fastifySwagger, {
  openapi: {
    info: {
      title: 'MangaForge API',
      version: '1.0.0',
      description: 'API para conversão e envio de mangás para Kindle',
      contact: { name: 'Equipe MangaForge' },
    },
    servers: [
      { url: `http://localhost:${env.PORT}`, description: 'Servidor local' }
    ],
    tags: [
      { name: 'Health', description: 'Health checks' },
      { name: 'Auth', description: 'Endpoints de autenticação' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  transform: jsonSchemaTransform, // Converts Zod schemas to OpenAPI
})

await app.register(fastifySwaggerUi, {
  routePrefix: '/api-docs',
  uiConfig: { docExpansion: 'list', deepLinking: false },
  staticCSP: true,
})
```

### Route with Zod Schema & OpenAPI (from `auth.routes.ts`)
```typescript
app.post('/auth/register', {
  schema: {
    tags: ['Auth'],
    summary: 'Cadastra um novo usuário',
    body: registerBodySchema, // Zod schema
    response: {
      201: z.object({ /* Zod response schema */ }),
      400: z.object({ error: z.string(), issues: z.any().optional() }),
      409: z.object({ error: z.string() }),
    },
  },
}, register)
```

### Benefits
- **Type-safe validation**: Zod schemas validated at runtime with full TypeScript inference
- **Auto-generated OpenAPI**: `jsonSchemaTransform` converts Zod → OpenAPI 3.0 automatically
- **Swagger UI**: Available at `/api-docs` for interactive API exploration
- **Shared schemas**: Zod schemas in `dtos/` can be shared with frontend via `packages/shared`