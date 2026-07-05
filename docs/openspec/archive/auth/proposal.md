## Why

The MangaInk Agent MVP required a functional authentication system to protect the conversion wizard and user library. A mocked auth system (`/login` accepting any credentials) was replaced with real JWT-based authentication backed by PostgreSQL.

## What Changed

### Project Restructure
- **DONE**: Monorepo with `apps/frontend` and `apps/backend` folders
- Frontend: React 19 + TypeScript + Vite 7 + TanStack Router (existing code)
- Backend: Node.js + **Fastify** + **Prisma ORM** + **PostgreSQL**
- Shared: `apps/shared` package for shared types

### Frontend Changes
- **DONE**: `AuthProvider` real implementation (`src/hooks/useAuth.tsx`)
- **DONE**: `authGuard` for TanStack Router route protection
- **DONE**: Login page with real form + backend integration
- **DONE**: Registration page with validation + backend integration
- **DONE**: API client (`src/lib/api.ts`) with JWT Bearer token handling
- **DONE**: Protected routes using `beforeLoad: authGuard`

### Backend Changes
- **DONE**: Fastify server with modular architecture
- **DONE**: PostgreSQL database with Prisma ORM
- **DONE**: Auth module with use-cases: login, register, me, update-me
- **DONE**: Unit tests for all use-cases
- **DONE**: E2E tests for auth endpoints
- **DONE**: JWT token generation with `@fastify/jwt`
- **DONE**: Password hashing with `bcryptjs`
- **DONE**: Zod validation schemas
- **DONE**: Swagger/OpenAPI documentation with `@fastify/swagger` + `@fastify/swagger-ui`

### Dependencies (Backend)
- `fastify` — Web framework
- `@fastify/jwt` — JWT plugin
- `@fastify/cors` — CORS
- `@fastify/swagger` — OpenAPI schema generation
- `fastify-type-provider-zod` — Zod integration
- `prisma` + `@prisma/client` — ORM
- `bcryptjs` — Password hashing
- `zod` — Validation
- `vitest` — Unit testing
- `supertest` — E2E testing

---

## Capabilities Delivered

### New Capabilities (All Implemented ✅)

- `user-auth`: User authentication with email/username + password
- `user-registration`: New user account creation
- `auth-guards`: Route protection via TanStack Router `beforeLoad`
- `backend-auth-api`: Fastify backend with modular auth endpoints
- `database-persistence`: PostgreSQL + Prisma for user storage
- `api-documentation`: Swagger/OpenAPI 3.0 at `/api-docs`

### Modified Capabilities

- None (no existing formal specs in this project)

---

## Impact

### New Project Structure
```
mangaink-agent/
├── apps/
│   ├── frontend/          ← React + Vite + TanStack Router
│   ├── backend/           ← Fastify + Prisma + PostgreSQL
│   └── shared/            ← Shared types
├── docs/
│   └── openspec/
├── package.json           ← Root workspace config
├── pnpm-workspace.yaml
└── docker-compose.yml
```

### Files Modified/Created (Frontend)
- `apps/frontend/src/hooks/useAuth.tsx` — Real auth context
- `apps/frontend/src/lib/api.ts` — API client
- `apps/frontend/src/types/auth.ts` — Auth types
- `apps/frontend/src/routes/-authGuard.ts` — Route guard
- `apps/frontend/src/routes/login.tsx` — Real login form
- `apps/frontend/src/routes/cadastro.tsx` — Real registration form
- `apps/frontend/src/routes/index.tsx` — Protected route
- `apps/frontend/src/routes/biblioteca.tsx` — Protected route

### Files Modified/Created (Backend)
- `apps/backend/src/modules/auth/use-cases/*.ts` — Auth use-cases
- `apps/backend/src/modules/auth/controllers/*.ts` — HTTP controllers
- `apps/backend/src/modules/auth/dtos/*.ts` — Zod schemas
- `apps/backend/src/modules/auth/services/*.ts` — Services
- `apps/backend/src/modules/auth/errors/auth.errors.ts` — Error classes
- `apps/backend/src/modules/auth/tests/unit/*.test.ts` — Unit tests
- `apps/backend/src/modules/auth/tests/e2e/auth.e2e.test.ts` — E2E tests

### Routes Available
- `POST /auth/register` — Register new user → `{ user, token }`
- `POST /auth/login` — Login → `{ user, token }`
- `GET /auth/me` — Get current user (requires Bearer token)
- `PATCH /users/me` — Update profile (requires Bearer token)
- `GET /api-docs` — Swagger UI

---

## Migration Plan (Completed)

### Phase 0: Monorepo Setup ✅
- [x] Create `apps/frontend`, `apps/backend`, `apps/shared`
- [x] Configure pnpm workspace

### Phase 1: Backend Foundation ✅
- [x] Prisma User model
- [x] Fastify server setup with JWT, Swagger
- [x] Docker Compose for PostgreSQL

### Phase 2: Auth Module - Use-Cases & Repository ✅
- [x] UserRepository with Prisma
- [x] DTOs with Zod schemas
- [x] Use-cases: login, register, me, update-me
- [x] Unit tests

### Phase 3: Auth Module - Routes & E2E Tests ✅
- [x] Auth routes with OpenAPI documentation
- [x] E2E tests

### Phase 4: Frontend Integration ✅
- [x] API client
- [x] AuthProvider
- [x] authGuard
- [x] Login/cadastro forms

### Phase 5: Polish & DevEx ✅
- [x] Dev scripts
- [x] Tests passing
- [x] README updated