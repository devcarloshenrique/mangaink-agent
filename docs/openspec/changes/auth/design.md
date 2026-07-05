## Context

The MangaForge project currently uses a fully mocked authentication system. The `AuthProvider` in `src/hooks/useAuth.tsx` provides a hardcoded user (`admin` / `admin@kindle.com`) and the `RequireAuth` guard in `src/components/auth/RequireAuth.tsx` renders children unconditionally. The `/login` and `/cadastro` routes accept any credentials without validation.

The project will be restructured into a **monorepo** with separate `apps/frontend` and `apps/backend` folders using **pnpm workspaces**:

- **Frontend**: React 19 + TypeScript + Vite 7 + TanStack Router (existing code moved to `apps/frontend`)
- **Backend**: Node.js + **Fastify** + **Prisma ORM** + **PostgreSQL** (already exists in `../manga-ink/backend`)
- **Database**: PostgreSQL running locally via **Docker Compose**
- **Architecture**: Modular architecture with **use-cases** (clean architecture pattern), **repositories**, **controllers**, **dtos** (Zod schemas), **services**, and **unit/e2e tests**
- **API Documentation**: **Swagger/OpenAPI 3.0** with **Zod schema auto-generation** via `fastify-type-provider-zod`

**Constraints:**
- Must work with local PostgreSQL via Docker Compose
- Backend API built with Fastify + TypeScript
- Prisma ORM for type-safe database access
- bcryptjs for password hashing (server-side only)
- JWT tokens via `@fastify/jwt` with HTTP-only cookies
- Zod for request/response validation (shared schemas where possible)
- Swagger/OpenAPI 3.0 documentation with auto-generation from Zod
- All UI text in Brazilian Portuguese
- Frontend uses existing tech stack: TanStack Router, Zod, react-hook-form, sonner for toasts
- Comic book pop-art design system (Tailwind v4 with custom theme)

## Goals / Non-Goals

**Goals:**
- Restructure project into monorepo with `apps/frontend` and `apps/backend`
- Replace mock auth with real JWT-based authentication system
- Implement Fastify backend with modular architecture (modules/use-cases)
- Implement secure login with email/password validation
- Implement user registration with email verification flow
- Add route protection with automatic redirect to `/login`
- Add session persistence across browser reloads
- Add logout functionality with token cleanup
- Maintain existing `AuthProvider` context API for consumers
- Implement backend API with PostgreSQL + Prisma for user persistence
- Provide Docker Compose for local PostgreSQL development
- Implement auth endpoints: login, register, refresh, logout, me
- **Write unit tests for all use-cases**
- **Write E2E tests for auth endpoints**
- **Integrate Swagger/OpenAPI documentation with Zod auto-generation**

**Non-Goals:**
- Social login (Google, GitHub, etc.) — can be added later
- MFA/2FA — can be added later
- Password reset flow — can be added later
- Role-based access control (RBAC) — single user role for now
- OAuth provider integration
- Email verification implementation (schema ready, flow deferred)

## Decisions

### 1. Project Structure: Monorepo with pnpm Workspaces

**Decision:** Use pnpm workspaces with `apps/frontend`, `apps/backend`, and optional `packages/shared`.

**Rationale:**
- Clear separation of concerns
- Shared tooling (ESLint, Prettier, TypeScript config)
- Independent builds and deployments
- Easy to add more apps/packages later

### 2. Backend Framework: Fastify

**Decision:** Use Fastify for the backend API.

**Rationale:**
- High performance, low overhead
- Excellent TypeScript support with type providers
- Rich plugin ecosystem (@fastify/jwt, @fastify/cors, @fastify/helmet, @fastify/rate-limit, @fastify/swagger, @fastify/swagger-ui)
- Native async/await support
- Schema-based validation with JSON Schema (compatible with Zod via fastify-type-provider-zod)
- Good testing support with `fastify.inject()`
- Built-in OpenAPI/Swagger support

**Alternatives considered:**
- Express: More familiar but slower, less TypeScript-native
- Hono: Lightweight but smaller ecosystem
- NestJS: Heavy, overkill for this project size

### 3. Architecture: Modular with Use-Cases (Clean Architecture)

**Decision:** Organize backend code into modules, each with use-cases, repositories, controllers, dtos, services, routes, and tests.

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
│   ├── refresh.use-case.ts
│   ├── logout.use-case.ts
│   └── me.use-case.ts
└── tests/
    ├── unit/
    │   ├── login.use-case.test.ts
    │   └── register.use-case.test.ts
    └── e2e/
        └── auth.e2e.test.ts
```

**Rationale:**
- Separation of business logic (use-cases) from infrastructure (repositories, controllers, routes)
- Use-cases are pure functions/classes — easy to unit test
- Repositories abstract database access — easy to mock
- Controllers handle HTTP concerns only — thin adapters
- Services encapsulate cross-cutting concerns (hashing, tokens)
- DTOs define validation schemas with Zod
- Routes are thin adapters with OpenAPI documentation — just HTTP handling
- Scales well as more modules are added (manga, conversion, scheduling, etc.)

**Alternatives considered:**
- Controllers + Services (traditional): Less testable, business logic mixed with framework
- Feature-based without use-cases: Logic leaks into routes

### 4. Authentication Strategy: JWT with HTTP-only Cookies

**Decision:** Use JWT access tokens + refresh tokens stored in **HTTP-only, Secure, SameSite=Lax cookies**.

**Rationale:**
- HTTP-only cookies prevent XSS token theft
- Secure flag ensures HTTPS-only transmission
- SameSite=Lax balances CSRF protection with usability
- Refresh token rotation provides additional security
- Works seamlessly with Fastify's `@fastify/cookie` and `@fastify/jwt`

**Token Configuration:**
- Access token: 15 minutes, signed with RS256 (or HS256 for simplicity)
- Refresh token: 7 days (30 days with "remember me"), stored in DB with hash
- Refresh token rotation: New refresh token issued on each refresh, old invalidated

### 5. Password Hashing: bcryptjs (Server-Side Only)

**Decision:** Hash passwords with bcryptjs (cost factor 12) on the server. Never hash on client.

**Rationale:**
- bcrypt is battle-tested, widely supported
- Cost factor 12 provides good security/performance balance
- Client-side hashing is security theater without backend verification
- Prisma stores only the hash

### 6. Database: PostgreSQL + Prisma ORM

**Decision:** Use PostgreSQL via Docker Compose for local development, Prisma ORM for type-safe database access.

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

**Rationale:**
- PostgreSQL: Robust, ACID-compliant, excellent JSON support
- Prisma: Type-safe, great DX, migrations, introspection
- Docker Compose: Consistent local environment, easy CI/CD

### 7. Validation: Zod + fastify-type-provider-zod

**Decision:** Use Zod schemas for validation, integrated with Fastify via `fastify-type-provider-zod`.

**Rationale:**
- Share validation schemas between frontend/backend (via `packages/shared` or duplication)
- Type-safe request/response validation
- Automatic OpenAPI/Swagger generation via `jsonSchemaTransform`
- Consistent with frontend react-hook-form + Zod

### 8. OpenAPI/Swagger Documentation: Auto-generated from Zod

**Decision:** Use `@fastify/swagger` + `@fastify/swagger-ui` with `fastify-type-provider-zod` for automatic OpenAPI 3.0 schema generation from Zod schemas.

**Implementation:**
```typescript
// app.ts
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import { jsonSchemaTransform, ZodTypeProvider } from 'fastify-type-provider-zod'

const app = Fastify().withTypeProvider<ZodTypeProvider>()

await app.register(swagger, {
  openapi: {
    info: {
      title: 'MangaForge API',
      version: '1.0.0',
      description: 'API para conversão e envio de mangás para Kindle',
      contact: { name: 'Equipe MangaForge' },
    },
    servers: [
      { url: `http://localhost:${env.PORT}`, description: 'Servidor local de desenvolvimento' },
    ],
    tags: [
      { name: 'Health', description: 'Endpoints para verificação do estado da aplicação' },
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

await app.register(swaggerUi, {
  routePrefix: '/api-docs',
  uiConfig: { docExpansion: 'list', deepLinking: false },
  staticCSP: true,
})
```

**Route Documentation with Zod (auth.routes.ts):**
```typescript
app.post('/auth/register', {
  schema: {
    tags: ['Auth'],
    summary: 'Cadastra um novo usuário',
    body: registerBodySchema, // Zod schema
    response: {
      201: z.object({
        user: z.object({
          id: z.string(),
          username: z.string(),
          email: z.string(),
          kindleEmail: z.string().nullable(),
          avatarUrl: z.string().nullable(),
        }),
        token: z.string(),
      }),
      400: z.object({
        error: z.string(),
        issues: z.any().optional(),
      }),
      409: z.object({
        error: z.string(),
      }),
    },
  },
}, register)
```

**Benefits:**
- **Single source of truth**: Zod schemas define both validation and documentation
- **Type-safe**: Full TypeScript inference for request/response
- **Auto-generated**: OpenAPI schema generated automatically, no manual YAML
- **Swagger UI**: Interactive API docs at `/api-docs`
- **Frontendpoints

### 9. Token Storage (Frontend): Memory + HTTP-only Cookies

**Decision:** Frontend does NOT store tokens. Backend sets HTTP-only cookies. Frontend only knows `isAuthenticated` via `/auth/me` call.

**Rationale:**
- Maximum XSS protection: tokens never accessible to JavaScript
- Automatic cookie handling by browser
- Session restoration via `/auth/me` on app mount
- Simpler frontend state management

### 10. Route Protection: TanStack Router `beforeLoad` Guard

**Decision:** Use TanStack Router's `beforeLoad` on protected routes.

**Rationale:**
- Runs before component renders — no flash of protected content
- Centralized in route tree
- Supports async checks (token validation via `/auth/me`)
- `RequireAuth` component removed entirely

### 11. Testing Strategy: Vitest + fastify.inject()

**Decision:** Use Vitest for unit tests, `fastify.inject()` for E2E tests (in-memory HTTP simulation).

**Test Structure:**
- **Unit tests**: Test use-cases in isolation with mocked repositories
- **E2E tests**: Test full HTTP request/response cycle with real Fastify app + test database

**Coverage targets:**
- Use-cases: 90%+ coverage
- E2E: Critical paths (login, register, refresh, logout, me)

**Rationale:**
- Vitest: Fast, native TypeScript, Vite-compatible
- `fastify.inject()`: In-memory HTTP simulation, no network overhead
- Test database: Separate test PostgreSQL (or SQLite for speed)

### 12. Auth Context API (Frontend): Minimal Breaking Changes

**Decision:** Keep existing `AuthProvider` shape but extend with real methods.

**Extended API:**
```typescript
interface AuthContext {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
}
```

**Rationale:**
- Existing components using `useAuth()` continue working
- New capabilities added without breaking consumers
- `isLoading` enables proper loading states during session restore

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| HTTP-only cookies require same domain | Use subdomain or proxy in dev (`/api` → backend) |
| Cookie CSRF risk | SameSite=Lax + short access token expiry |
| Refresh token theft | Rotation + DB hash + short expiry |
| Monorepo complexity | Start simple, add tooling (Turborepo) if needed |
| Database migrations in CI | Prisma migrate deploy in pipeline |
| Test database management | Docker Compose test profile or SQLite |
| Frontend-backend schema drift | Shared `packages/shared` or codegen |

## Migration Plan

### Phase 0: Monorepo Setup
1. Create `apps/frontend` — move existing React app
2. Create `apps/backend` — copy from `../manga-ink/backend` or link
3. Configure `pnpm-workspace.yaml`, root `package.json`
4. Set up shared TypeScript/ESLint/Prettier configs
5. Create `docker-compose.yml` for PostgreSQL (dev + test)

### Phase 1: Backend Foundation (Already Done)
6. `prisma/schema.prisma` — User model ✅
7. `src/shared/prisma/prisma.ts` — Prisma singleton ✅
8. `src/shared/errors/` — Custom error classes ✅
9. `src/app.ts` — Fastify setup (plugins: cors, helmet, rate-limit, cookie, jwt, zod, swagger) ✅
10. `src/server.ts` — Entry point ✅
11. Docker Compose for PostgreSQL ✅
12. Run migrations, verify connection ✅

### Phase 2: Auth Module - Use-Cases & Repository (Already Done)
13. `user.repository.ts` — Prisma user CRUD ✅
14. `dtos/*.ts` — Zod schemas (login, register, update-me, tokens) ✅
15. Use-cases: `login`, `register`, `refresh`, `logout`, `me` ✅
16. Unit tests for all use-cases (mock repository) ✅

### Phase 3: Auth Module - Routes & E2E Tests (Already Done)
17. `auth.routes.ts` — Fastify routes with Zod validation & OpenAPI ✅
18. E2E tests for all endpoints ✅
19. Integration test with real database ✅
20. Swagger UI available at `/api-docs` ✅

### Phase 4: Frontend Integration
21. Move frontend to `apps/frontend`
22. Update imports/paths
23. `src/lib/api.ts` — API client with cookie handling
24. `src/types/auth.ts` — Shared types
25. Rewrite `useAuth.tsx` with real implementation
26. `authGuard.ts` — TanStack Router `beforeLoad` guard
27. Apply guard to all protected routes
28. Rewrite `login.tsx` and `cadastro.tsx` with real forms
29. Add logout button to header/profile

### Phase 5: Polish & DevEx
30. Dev scripts: `pnpm dev` (runs both), `pnpm dev:frontend`, `pnpm dev:backend`
31. Test full flow: register → login → protected route → refresh → logout
32. Run lint, format, build, tests
33. Document setup in README
34. Verify Swagger documentation at `/api-docs`

## Open Questions

1. **Email verification flow:** o login não precisa ser necessariamente um email, pode ser um username maior que 3 caracteres 
2. **Token expiry values:** O token deve ser lembrado por 7d
3. **Password requirements:** pode ser qualquer senha com no minimo 4 caracteres
4. **Account deletion:** não acrescente nada referente a deletar conta agora?
5. **Remember me checkbox:** não quero o checkbox?
6. **Shared package:** Create `packages/shared` for Zod schemas/types, or duplicate? Sim pode criar a pasta shared para código compartilhado. 
7. **Test database:** Utilize sqlite para os testes de unidade?
8. **CI/CD:** GitHub Actions workflow for lint, test, build?