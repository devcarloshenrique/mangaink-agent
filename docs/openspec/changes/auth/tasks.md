## 1. Monorepo Setup

- [x] 1.1 Create pnpm-workspace.yaml with apps/* pattern
- [x] 1.2 Update root package.json with workspace configuration and concurrent dev scripts
- [ ] 1.3 Move existing frontend to apps/frontend (opcional — frontend funciona standalone na raiz)
- [x] 1.4 Frontend package.json já correto (standalone na raiz)
- [x] 1.5 vite.config.ts com proxy /api → backend porta 3333
- [x] 1.6 tsconfig.json já correto
- [x] 1.7 Backend criado em apps/backend (construído a partir do manga-ink como referência)
- [x] 1.8 apps/backend/package.json com nome @mangaink/backend
- [x] 1.9 apps/backend/docker-compose.yml para PostgreSQL local
- [ ] 1.10 packages/shared — schemas Zod compartilhados (opcional para esta entrega)

> **Estrutura atual do monorepo:**
> ```
> mangaink-agent/           ← raiz pnpm workspace
> ├── apps/
> │   └── backend/          ← Fastify + Prisma + PostgreSQL (NOVO)
> ├── src/                  ← frontend React standalone (funciona como antes)
> ├── pnpm-workspace.yaml   ← inclui apps/*
> └── package.json          ← scripts dev:frontend, dev:backend, dev:full
> ```

## 2. Backend Auth Module (Implementado - apps/backend)

- [x] 2.1 apps/backend/prisma/schema.prisma com modelo User
- [x] 2.2 apps/backend/src/modules/auth/use-cases/ (login, register, get-me, update-me)
- [x] 2.3 apps/backend/src/modules/user/repositories/ (interface + PrismaUserRepository)
- [x] 2.4 apps/backend/src/modules/auth/auth.routes.ts com Zod + OpenAPI schemas
- [x] 2.5 apps/backend/src/modules/auth/dtos/ (login, register, update-me)
- [x] 2.6 apps/backend/src/modules/auth/controllers/ (register, login, me, update-me)
- [x] 2.7 apps/backend/src/shared/server.ts com Swagger + Zod type provider
- [x] 2.8 apps/backend/docker-compose.yml para PostgreSQL

> **Backend implementado:** `apps/backend` — Fastify 5 + Prisma 7 + JWT Bearer + Swagger UI

## 3. Shared Package

- [x] 3.1 Tipos em src/types/auth.ts (frontend)
- [x] 3.2 Schemas Zod nos formulários login.tsx e cadastro.tsx
- [x] 3.3 apps/backend/src/modules/auth/dtos/ com schemas Zod
- [ ] 3.4 packages/shared (opcional — compartilhamento de tipos entre frontend e backend)

## 4. Frontend - API Client & Types

- [x] 4.1 src/lib/api.ts com Bearer token + interceptors
- [x] 4.2 src/types/auth.ts com tipos TypeScript
- [x] 4.3 Proxy Vite /api → backend porta 3333

## 5. Frontend - Auth Context (useAuth)

- [x] 5.1 src/hooks/useAuth.tsx com implementação real
- [x] 5.2 login(credentials) → POST /api/auth/login
- [x] 5.3 register(data) → POST /api/auth/register
- [x] 5.4 logout() — limpa token local
- [x] 5.5 refreshSession() → GET /api/auth/me
- [x] 5.6 updateProfile(data) → PATCH /api/users/me
- [x] 5.7 Restauração de sessão no mount via GET /api/auth/me
- [x] 5.8 isLoading durante restauração de sessão

## 6. Frontend - Route Protection

- [x] 6.1 src/routes/-authGuard.ts com beforeLoad guard
- [x] 6.2 Rotas protegidas: /, /biblioteca, /wizard, /agendamentos, /configuracoes, /fontes, /perfil
- [x] 6.3 Redirect não-autenticados → /login
- [x] 6.4 Redirect autenticados fora de /login e /cadastro → /

## 7. Frontend - Login Page

- [x] 7.1 src/routes/login.tsx com formulário real
- [x] 7.2 react-hook-form + Zod validation
- [x] 7.3-7.8 Campos, loading state, toasts de erro, redirect

## 8. Frontend - Registration Page

- [x] 8.1-8.10 src/routes/cadastro.tsx completo

## 9. Frontend - Logout & Profile

- [x] 9.1 Logout no header (ComicHeader)
- [x] 9.2 /perfil protegida
- [ ] 9.3 Formulário de perfil completo (pendente)

## 10. Dev Scripts & Testing

- [x] 10.1 pnpm dev:full — roda frontend e backend juntos (concurrently)
- [x] 10.2 pnpm dev:frontend e pnpm dev:backend
- [x] 10.3 Fluxo: register → login → rota protegida → logout
- [ ] 10.4 Lint, format, testes unitários
- [x] 10.5 Swagger UI em http://localhost:3333/api-docs

## Limpeza de Arquivos (DONE)

- [x] Removido bun.lock, .lovable/, supabase/, src/integrations/supabase/
- [x] Atualizado .env (removidas vars Supabase, adicionado VITE_API_URL)