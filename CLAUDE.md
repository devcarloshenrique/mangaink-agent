# CLAUDE.md

Este arquivo fornece orientações ao Claude Code ao trabalhar com este repositório.

## Projeto: MangaInk Agent

Aplicação web self-hosted que converte mangás de fontes online em formatos compatíveis com Kindle (EPUB, MOBI, CBZ, KFX) e os envia ao dispositivo Kindle. A UI está em **Português Brasileiro** com design temático de quadrinhos pop-art.

---

## Estrutura do Monorepo

```
mangaink-agent/
├── apps/
│   ├── frontend/              ← React 19 + Vite + TanStack Router
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── ui/            (shadcn/ui — ~40 primitives Radix)
│   │   │   │   ├── comic/         (ComicPanel, SpeechBubble, StepIndicator, etc.)
│   │   │   │   ├── auth/          (RequireAuth)
│   │   │   │   ├── dashboard/     (StatsRow, ActivityFeed, LastReadCard, etc.)
│   │   │   │   ├── biblioteca/    (CollectionManager, FilterBar, SearchBar, etc.)
│   │   │   │   ├── wizard/        (ComparisonSlider)
│   │   │   │   ├── agendamentos/  (Timeline)
│   │   │   │   ├── perfil/        (Achievements, MonthlyChart, TopReadings)
│   │   │   │   ├── reader/        (ReaderToolbar)
│   │   │   │   ├── fontes/        (SuggestSourceForm)
│   │   │   │   ├── theme/         (ThemeSelector, ComicIntensitySlider)
│   │   │   │   ├── notifications/ (ComicToast, NotificationBell)
│   │   │   │   └── onboarding/    (OnboardingOverlay)
│   │   │   ├── hooks/            (useAuth, useBiblioteca, useConversion, etc.)
│   │   │   ├── integrations/     (API client, TanStack Query mutations)
│   │   │   ├── lib/              (utils, mock-data, kindle-presets, etc.)
│   │   │   ├── routes/           (TanStack file-based routing)
│   │   │   ├── stories/          (Storybook)
│   │   │   ├── types/            (tipagens globais)
│   │   │   ├── styles.css        (tema Tailwind v4 @theme inline)
│   │   │   ├── main.tsx
│   │   │   └── router.tsx        (TanStack Router config)
│   │   ├── .storybook/
│   │   ├── .tanstack/            (cache do router — não editar)
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json          (@mangaink/frontend)
│   │
│   ├── backend/                  ← Fastify + Prisma + PostgreSQL
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── auth/         (controllers, services, use-cases, dtos, tests)
│   │   │   │   ├── user/         (entities, repositories)
│   │   │   │   └── health/       (controller + routes)
│   │   │   └── shared/
│   │   │       ├── config/       (env.ts — Zod env vars)
│   │   │       ├── database/     (prisma.ts — singleton)
│   │   │       ├── middlewares/  (verify-jwt.ts)
│   │   │       └── server.ts     (plugins, CORS, JWT, Swagger)
│   │   ├── prisma/
│   │   │   └── migrations/
│   │   ├── package.json          (@mangaink/backend)
│   │   └── tsconfig.json
│   │
│   └── shared/                   ← Pacote compartilhado para schemas e tipos
│       ├── src/
│       │   ├── auth.ts           (schemas Zod: login, register, update-me)
│       │   ├── user.ts           (tipos de usuário — a criar)
│       │   └── index.ts          (re-export público)
│       ├── package.json          (@mangaink/shared)
│       └── tsconfig.json
│
├── docs/
│   ├── modelagem.md
│   ├── sprints.md
│   └── openspec/
│       ├── archive/auth/         (design, spec, proposal, tasks)
│       └── changes/auth/         (config de alterações)
│
├── package.json                  ← scripts orquestradores do monorepo
├── pnpm-workspace.yaml
├── docker-compose.yml
├── .gitignore
└── README.md
```

---

## Tech Stack

### Frontend (`apps/frontend`)
- **React 19** + **TypeScript** (strict)
- **Vite 7** (build tool)
- **TanStack Router** (file-based routing via `createFileRoute`)
- **TanStack Query** (data fetching)
- **Tailwind CSS v4** com tema de quadrinhos customizado
- **Radix UI** primitives (shadcn/ui — componentes em `src/components/ui/`)
- **Zod** (validação) + **react-hook-form** + `@hookform/resolvers`
- **sonner** (toasts)

### Backend (`apps/backend`)
- **Fastify 5** + **TypeScript**
- **Prisma 7** (ORM) + **PostgreSQL**
- **@fastify/jwt** (autenticação JWT)
- **@fastify/swagger** + **@fastify/swagger-ui** (documentação da API)
- **Zod** (validação com `fastify-type-provider-zod`)
- **bcryptjs** (hash de senhas)
- **Arquitetura modular:** controllers → use-cases → repositories → entities
- **Testes:** Vitest unitários + E2E com in-memory + mock repositories

### Shared (`apps/shared`)
- **Zod** schemas compartilhados entre frontend e backend
- Tipos `PublicUser`, `AuthResponse`, `LoginDTO`, `RegisterDTO`, `UpdateMeDTO`
- Validacões centralizadas: login, registro, atualizacão de perfil

---

## Comandos

### Raiz do monorepo

```bash
pnpm dev           # Frontend em http://localhost:5173
pnpm dev:backend   # Backend em http://localhost:3333
pnpm dev:full      # Frontend + Backend simultaneamente
pnpm build         # Build de produção do frontend
pnpm lint          # ESLint em todos os pacotes
pnpm format        # Prettier em todos os pacotes
pnpm test          # Testes do backend (Vitest)
pnpm db:migrate    # Executa migrations do Prisma
pnpm db:push       # Push do schema sem migration
pnpm db:studio     # Prisma Studio (GUI do banco)
pnpm storybook     # Storybook em http://localhost:6006
```

### Dentro de `apps/frontend`

```bash
pnpm dev           # Vite dev server
pnpm build         # Build de produção
pnpm lint          # ESLint
pnpm format        # Prettier
```

### Dentro de `apps/backend`

```bash
pnpm dev           # tsx watch src/app.ts
pnpm build         # tsc
pnpm test          # vitest run
pnpm test:watch    # vitest (modo watch)
pnpm db:migrate    # prisma migrate dev
pnpm db:push       # prisma db push
pnpm db:studio     # prisma studio
```

---

## Roteamento (TanStack Router)

File-based routing em `apps/frontend/src/routes/`:

| Arquivo                           | Rota                                               |
| --------------------------------- | -------------------------------------------------- |
| `src/routes/__root.tsx`           | Root layout (envolve tudo com `AuthProvider`)      |
| `src/routes/index.tsx`            | `/` — Dashboard (requer auth)                      |
| `src/routes/login.tsx`            | `/login` — Página de login                         |
| `src/routes/cadastro.tsx`         | `/cadastro` — Registro de novo usuário             |
| `src/routes/wizard.tsx`           | `/wizard` — Wizard de conversão (5 passos)         |
| `src/routes/biblioteca.tsx`       | `/biblioteca` — Layout raiz da biblioteca          |
| `src/routes/biblioteca.index.tsx` | `/biblioteca` — Listagem de mangás convertidos     |
| `src/routes/biblioteca.$slug.tsx` | `/biblioteca/:slug` — Detalhe da série             |
| `src/routes/biblioteca.converter.$jobId.tsx` | `/biblioteca/converter/:jobId` — Job de conversão       |
| `src/routes/agendamentos.tsx`     | `/agendamentos` — Assinaturas agendadas            |
| `src/routes/fontes.tsx`           | `/fontes` — Sugestão de novas fontes               |
| `src/routes/configuracoes.tsx`    | `/configuracoes` — Configurações                   |
| `src/routes/perfil.tsx`           | `/perfil` — Perfil do usuário                      |

> **Importante:** O arquivo `src/routeTree.gen.ts` é gerado automaticamente. Não editar manualmente. Rode `pnpm dev` para regenerar ao criar novas rotas.

---

## Autenticação

Autenticação JWT real via backend Fastify:
- `POST /auth/register` — Registro de novo usuário
- `POST /auth/login` — Login, retorna `{ token }`
- `GET /users/me` — Perfil do usuário autenticado (requer Bearer token)

O frontend usa `beforeLoad` guard do TanStack Router para proteger rotas. O token JWT é armazenado e injetado via `useAuth` hook.

---

## Arquitetura

### Frontend

- `__root.tsx` envolve tudo em `<AuthProvider>` e renderiza `<Outlet />`
- Rotas protegidas usam `beforeLoad` para redirecionar para `/login` se não autenticado
- Rotas usam padrão `createFileRoute("/path")({ component: Page })`
- Navegação via `useNavigate({ to: "/path" })` e `<Link to="/path">`

### Componentes do Frontend

- `src/components/ui/` — shadcn/ui (~40 primitivas Radix): button, card, dialog, form, table, tabs, sidebar, chart, carousel, drawer, etc.
- `src/components/comic/` — UI temática: `ComicPanel`, `ComicHeader`, `SpeechBubble`, `OnomatopoeiaBadge`, `StepIndicator`, `AnimatedCounter`, `IntensityControl`, `MockPage`, `ThemeToggle`
- `src/components/auth/` — `RequireAuth` (guards de autenticação)
- `src/components/dashboard/` — `StatsRow`, `ActivityFeed`, `LastReadCard`, `NextScheduleBanner`, `NextScheduleCard`, `AnimatedCounter`
- `src/components/biblioteca/` — `CollectionManager`, `FilterBar`, `SearchBar`, `SeriesActionsMenu`, `DeleteConfirmDialog`, `ReconvertDialog`, `RenameSeriesDialog`
- `src/components/wizard/` — `ComparisonSlider`
- `src/components/agendamentos/` — `Timeline`
- `src/components/perfil/` — `Achievements`, `MonthlyChart`, `TopReadings`
- `src/components/reader/` — `ReaderToolbar`
- `src/components/fontes/` — `SuggestSourceForm`
- `src/components/theme/` — `ThemeSelector`, `ComicIntensitySlider`, `ThemeToggle`
- `src/components/notifications/` — `ComicToast`, `NotificationBell`
- `src/components/onboarding/` — `OnboardingOverlay`

### Backend

- `src/app.ts` — entry point, inicia o servidor Fastify
- `src/shared/server.ts` — criação e configuração do servidor (plugins, CORS, JWT, Swagger)
- `src/shared/config/env.ts` — parse e validação das env vars (Zod)
- `src/shared/database/prisma.ts` — singleton do Prisma Client
- `src/shared/middlewares/verify-jwt.ts` — middleware de autenticação JWT

### Módulos do Backend

Cada módulo segue uma **arquitetura em camadas**:

- **`auth/`** — Autenticação e gestão de usuário
  - `auth.routes.ts` — Definição das rotas
  - `controllers/` — `register.controller.ts`, `login.controller.ts`, `me.controller.ts`, `update-me.controller.ts`
  - `use-cases/` — `register.use-case.ts`, `login.use-case.ts`, `get-me.use-case.ts`, `update-me.use-case.ts`
  - `services/` — `password-hasher.ts`, `token.service.ts`
  - `errors/` — `auth.errors.ts`
  - `dtos/` — `login.dto.ts`, `register.dto.ts`, `update-me.dto.ts`
  - `tests/` — Testes unitários (Vitest) + E2E com in-memory/mock repositories

- **`user/`** — Entidade e repositório de usuário
  - `entities/user.entity.ts` — Entidade de domínio
  - `repositories/` — `user.repository.ts` (interface), `prisma-user.repository.ts` (implementação Prisma)

- **`health/`** — Health check da API
  - `health.controller.ts`, `health.routes.ts`

---

## Design System (Frontend)

Definido em `src/styles.css` com Tailwind v4 `@theme inline`:

- **Cores:** `--comic-yellow`, `--comic-red`, `--comic-blue`, `--comic-cream`, `--comic-ink` (oklch)
- **Fontes:** `--font-display` (Bangers), `--font-sans` (Inter)
- **Sombras:** `--shadow-comic-sm` (3px), `--shadow-comic` (6px), `--shadow-comic-lg` (10px) — hard offset shadows
- **Utilitários:** `.font-display`, `.border-ink`, `.shadow-comic-sm`, `.bg-halftone`, `.animate-comic-pop`, `.animate-comic-shake`
- **Dark mode:** suportado via classe `.dark`

---

## Path Aliases

No frontend: `@/` aponta para `src/` (configurado via `vite-tsconfig-paths` e `tsconfig.json`).

---

## Convenções

- Toda UI está em **Português Brasileiro**
- Use `cn()` para merge condicional de classes
- Use `ComicPanel` para containers com estilo de quadrinhos (props: `tilt`, `bg`, `padding`)
- Use `sonner` para toasts via `toast.success()` / `toast.error()`
- O componente `Toaster` deve ser montado em cada página
- Backend segue padrão de módulos (module per feature): `routes.ts`, `handler.ts`, `schema.ts`
