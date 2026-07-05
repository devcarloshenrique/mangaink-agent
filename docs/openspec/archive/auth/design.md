## Context

The MangaInk Agent project has been restructured into a **monorepo** with separate `apps/frontend` and `apps/backend` folders using pnpm workspaces. The authentication system is **fully implemented** with JWT access tokens stored in memory + localStorage for the MVP.

Current status:
- **Frontend**: Real auth forms (login/cadastro) fully integrated with backend API
- **Backend**: Fastify + Prisma + PostgreSQL with modular auth module (use-cases, controllers, DTOs)
- **Testing**: Unit and E2E tests implemented for auth use-cases
- **Documentation**: Swagger UI available at `/api-docs`

## Implemented Changes (COMPLETED)

### ✅ Project Restructure
- Monorepo with `apps/frontend` and `apps/backend` folders
- Frontend: React 19 + TypeScript + Vite 7 + TanStack Router
- Backend: Node.js + Fastify + Prisma ORM + PostgreSQL
- `apps/shared` package for shared types

### ✅ Frontend Integration
- `AuthProvider` context (`apps/frontend/src/hooks/useAuth.tsx`)
  - Real implementation with `login`, `register`, `logout` methods
  - Session restoration via `/auth/me` on mount
  - Token stored in memory + localStorage (NOT HTTP-only cookies)
- `authGuard` (`apps/frontend/src/routes/-authGuard.ts`)
  - TanStack Router `beforeLoad` guard for protected routes
  - `guestGuard` for login/cadastro pages (redirects authenticated users)
- Real login form (`apps/frontend/src/routes/login.tsx`)
  - Zod validation schema (identifier: min 3 chars, password: required)
  - API integration via `authApi.login()`
  - Toast notifications for success/error
- Real registration form (`apps/frontend/src/routes/cadastro.tsx`)
  - Zod validation (username: 3-50 chars alphanumeric, email: valid email, password: min 4 chars)
  - Password confirmation match validation
  - API integration via `authApi.register()`
- API client (`apps/frontend/src/lib/api.ts`)
  - `authApi`: login, register, me, logout
  - `userApi`: updateMe (PATCH `/users/me`)
  - Token management in `tokenStore` (memory + localStorage)
- Protected routes (using `beforeLoad: authGuard`):
  - `/` (dashboard)
  - `/biblioteca` (biblioteca layout)

### ✅ Backend Foundation
- Fastify server (`apps/backend/src/app.ts`)
  - Entry point for dev server
- Server setup (`apps/backend/src/shared/server.ts`)
  - CORS, JWT, Swagger/OpenAPI configuration
- PostgreSQL via Docker Compose (`docker-compose.yml` at root)
- Prisma schema (User model with id, username, email, passwordHash, kindleEmail, avatarUrl, isActive, timestamps)

### ✅ Auth Module - Use-Cases, Repository, Services
- `user.repository.ts` / `prisma-user.repository.ts` — Prisma user CRUD
- `dtos/*.ts` — Zod schemas (login, register, update-me)
  - `loginSchema`: identifier (min 3 chars), password (required)
  - `registerBodySchema`: username, email, password, confirmPassword
  - `registerSchema`: refinement for password match
  - `updateMeSchema`: username, email, kindleEmail, avatarUrl, currentPassword, password
- Use-cases:
  - `login.use-case.ts` — Validate credentials, return user + JWT token (15d expiry)
  - `register.use-case.ts` — Create user with hashed password, return user + JWT token
  - `get-me.use-case.ts` — Return current user profile
  - `update-me.use-case.ts` — Update user profile
- Services:
  - `password-hasher.ts` — BcryptPasswordHasher (cost factor 12)
  - `token.service.ts` — JwtTokenService wrapping Fastify JWT
- Controllers:
  - `login.controller.ts` — HTTP handler for POST `/auth/login`
  - `register.controller.ts` — HTTP handler for POST `/auth/register`
  - `me.controller.ts` — HTTP handler for GET `/auth/me`
  - `update-me.controller.ts` — HTTP handler for PATCH `/users/me`
- Errors:
  - `auth.errors.ts` — InvalidCredentialsError, UserAlreadyExistsError, UsernameAlreadyExistsError, EmailAlreadyExistsError
- Unit tests (`apps/backend/src/modules/auth/tests/unit/`):
  - `login.use-case.test.ts`
  - `register.use-case.test.ts`
  - `get-me.use-case.test.ts`
  - `update-me.use-case.test.ts`
- E2E tests (`apps/backend/src/modules/auth/tests/e2e/auth.e2e.test.ts`):
  - Register, login, me, update-me flows

### ✅ Swagger/OpenAPI Integration
- Configuration in `shared/server.ts`
- `jsonSchemaTransform` converts Zod schemas to OpenAPI 3.0 automatically
- All auth endpoints documented with request/response schemas
- Security scheme `bearerAuth` configured for protected endpoints
- Swagger UI available at `/api-docs`

---

## Decisions (IMPLEMENTED)

### 1. Project Structure: Monorepo with pnpm Workspaces ✅
**Rationale:**
- Clear separation of concerns
- Shared tooling (ESLint, Prettier, TypeScript config)
- Independent builds and deployments
- Easy to add more apps/packages later

### 2. Backend Framework: Fastify ✅
**Rationale:**
- High performance, low overhead
- Excellent TypeScript support with type providers
- Rich plugin ecosystem (@fastify/jwt, @fastify/cors, @fastify/swagger, @fastify/swagger-ui)
- Native async/await support
- Schema-based validation with JSON Schema (compatible with Zod via fastify-type-provider-zod)
- Good testing support with `fastify.inject()`

### 3. Architecture: Modular with Use-Cases (Clean Architecture) ✅
```
src/modules/auth/
├── controllers/
│   ├── login.controller.ts
│   ├── register.controller.ts
│   ├── me.controller.ts
│   └── update-me.controller.ts
├── dtos/
│   ├── login.dto.ts
│   ├── register.dto.ts
│   └── update-me.dto.ts
├── errors/
│   └── auth.errors.ts
├── repositories/
│   └── user.repository.ts
├── routes/
│   └── auth.routes.ts
├── services/
│   ├── password-hasher.ts
│   └── token.service.ts
├── use-cases/
│   ├── login.use-case.ts
│   ├── register.use-case.ts
│   ├── get-me.use-case.ts
│   └── update-me.use-case.ts
└── tests/
    ├── unit/
    └── e2e/
```

### 4. Authentication Strategy: Single JWT Token (NOT HTTP-only cookies) ✅
**Decision:** Single long-lived JWT (15 days expiry) returned by login/register, stored in memory + localStorage.

**Rationale:**
- Simpler implementation for MVP
- HTTP-only cookies deferred to future enhancement
- localStorage allows token persistence across reloads

**Migration Path:** Future work to implement HTTP-only cookies with refresh token rotation.

### 5. Password Hashing: bcryptjs (Server-Side Only) ✅
**Decision:** Hash passwords with bcryptjs (cost factor 12) on the server.

### 6. Database: PostgreSQL + Prisma ORM ✅
**Schema (prisma/schema.prisma):**
```prisma
model User {
  id            String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  username      String    @unique @db.VarChar(50)
  email         String    @unique @db.VarChar(255)
  passwordHash  String    @map("password_hash")
  kindleEmail   String?   @db.VarChar(255) @map("kindle_email")
  avatarUrl     String?   @map("avatar_url")
  isActive      Boolean   @default(true) @map("is_active")
  createdAt     DateTime  @default(now()) @db.Timestamptz @map("created_at")
  updatedAt     DateTime  @default(now()) @updatedAt @db.Timestamptz @map("updated_at")

  @@map("users")
}
```

### 7. Validation: Zod + fastify-type-provider-zod ✅
**Decision:** Use Zod schemas for validation, integrated with Fastify.

### 8. OpenAPI/Swagger Documentation: Auto-generated from Zod ✅
**Decision:** Use `@fastify/swagger` + `@fastify/swagger-ui` with `fastify-type-provider-zod`.

### 9. Token Storage (Frontend): Memory + localStorage ✅
**Decision:** JWT stored in React state (memory) AND localStorage for persistence.

### 10. Route Protection: TanStack Router `beforeLoad` Guard ✅
**Decision:** Protected routes use `beforeLoad: authGuard` pattern.

### 11. Testing Strategy: Vitest + fastify.inject() ✅
**Decision:** Unit tests with InMemoryUserRepository, E2E tests with `fastify.inject()`.

---

## What Was Deferred (For Future Specs)

| Feature | Reason | Status |
|---------|--------|--------|
| HTTP-only cookies | Requires same-domain dev setup or proxy | 🔄 Future |
| Refresh token rotation | Complexity for MVP | 🔄 Future |
| Short-lived access token (15min) | MVP uses 15d token | 🔄 Future |
| Backend logout endpoint | No DB token storage yet | 🔄 Future |
| Email verification | Requires email service | 🔄 Future |
| Password reset | Requires email service | 🔄 Future |
| RBAC | Single user role for MVP | 🔄 Future |

---

## Implementation Checklist (ALL COMPLETED)

- [x] Monorepo structure (apps/frontend, apps/backend, apps/shared)
- [x] Backend: Prisma User model
- [x] Backend: Auth module with use-cases, controllers, DTOs
- [x] Backend: Unit tests for all auth use-cases
- [x] Backend: E2E tests for auth endpoints
- [x] Backend: Swagger/OpenAPI with Zod auto-generation
- [x] Frontend: AuthProvider with real implementation
- [x] Frontend: API client (lib/api.ts)
- [x] Frontend: Login form with validation
- [x] Frontend: Registration form with validation
- [x] Frontend: authGuard for protected routes
- [x] Frontend: Protected routes applied
- [x] Dev scripts (pnpm dev, pnpm dev:backend, pnpm dev:full)