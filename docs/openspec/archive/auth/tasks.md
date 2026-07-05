# Auth Implementation Tasks

## 1. Monorepo Setup

- [x] 1.1 Create pnpm-workspace.yaml with apps/* pattern
- [x] 1.2 Update root package.json with workspace configuration and concurrent dev scripts
- [x] 1.3 Monorepo structure: apps/frontend, apps/backend, apps/shared
- [x] 1.4 Frontend package.json with @mangaink/frontend
- [x] 1.5 vite.config.ts with proxy /api → backend port 3333
- [x] 1.6 tsconfig.json with @ alias for src/
- [x] 1.7 Backend created in apps/backend
- [x] 1.8 apps/backend/package.json with @mangaink/backend
- [x] 1.9 Backend Prisma + PostgreSQL

> **Status: COMPLETED** — Monorepo structure established

## 2. Backend Auth Module

- [x] 2.1 apps/backend/prisma/schema.prisma with User model
- [x] 2.2 apps/backend/src/modules/auth/use-cases (login, register, get-me, update-me)
- [x] 2.3 apps/backend/src/modules/user/repositories (interface + PrismaUserRepository)
- [x] 2.4 apps/backend/src/modules/auth/auth.routes.ts with Zod + OpenAPI schemas
- [x] 2.5 apps/backend/src/modules/auth/dtos (login, register, update-me)
- [x] 2.6 apps/backend/src/modules/auth/controllers (register, login, me, update-me)
- [x] 2.7 apps/backend/src/shared/server.ts with Swagger + Zod type provider
- [x] 2.8 apps/shared for shared types

> **Status: COMPLETED** — All backend auth functionality implemented

## 3. Frontend - API Client & Types

- [x] 3.1 src/lib/api.ts with Bearer token management
- [x] 3.2 src/types/auth.ts with TypeScript types
- [x] 3.3 Vite proxy /api → backend

> **Status: COMPLETED**

## 4. Frontend - Auth Context (useAuth)

- [x] 4.1 src/hooks/useAuth.tsx with real implementation
- [x] 4.2 login(credentials) → POST /api/auth/login
- [x] 4.3 register(data) → POST /api/auth/register
- [x] 4.4 logout() — clears token from memory/localStorage
- [x] 4.5 refreshSession() → GET /api/auth/me
- [x] 4.6 updateProfile(data) → PATCH /api/users/me
- [x] 4.7 Session restoration on mount via GET /api/auth/me
- [x] 4.8 isLoading during session restoration

> **Status: COMPLETED**

## 5. Frontend - Route Protection

- [x] 5.1 src/routes/-authGuard.ts with beforeLoad guard
- [x] 5.2 Protected routes applied: /, /biblioteca, /wizard, /agendamentos, /configuracoes, /fontes, /perfil
- [x] 5.3 Unauthenticated users redirected to /login
- [x] 5.4 Authenticated users on guest routes (login/cadastro) redirected to /

> **Status: COMPLETED**

## 6. Frontend - Login Page

- [x] 6.1 src/routes/login.tsx with real form
- [x] 6.2 react-hook-form + Zod validation
- [x] 6.3 Loading state (isSubmitting)
- [x] 6.4 Toast notifications (success/error)
- [x] 6.5 Redirect after login to intended page

> **Status: COMPLETED**

## 7. Frontend - Registration Page

- [x] 7.1-7.10 src/routes/cadastro.tsx complete with validation

> **Status: COMPLETED**

## 8. Testing

- [x] 8.1 Unit tests for login, register, me use-cases
- [x] 8.2 E2E tests for auth endpoints
- [x] 8.3 All tests passing

> **Status: COMPLETED**

## 9. Documentation

- [x] 9.1 Swagger UI at http://localhost:3333/api-docs
- [x] 9.2 OpenAPI 3.0 schema auto-generated from Zod

> **Status: COMPLETED**

---

# Archive Note

This spec is **COMPLETE** as of 2026-07-05. The auth system is fully functional with:
- Real JWT-based authentication (15d tokens)
- Login with email/username + password
- User registration with validation
- Protected routes via TanStack Router guards
- Session persistence
- Backend with Fastify, Prisma, Swagger

**Future enhancements** (NOT in this spec):
- HTTP-only cookies
- Refresh token rotation
- Short-lived access tokens (15min)
- Backend logout endpoint (token invalidation)
- Email verification
- Password reset