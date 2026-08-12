# CLAUDE.md

Este arquivo fornece orientações ao Claude Code ao trabalhar com este repositório.

## Projeto: MangaInk Agent

Aplicação web self-hosted que converte mangás de fontes online em formatos compatíveis com Kindle (EPUB, MOBI, CBZ) e os envia ao dispositivo Kindle. A UI está em **Português Brasileiro** com design temático de quadrinhos pop-art.

> **Dependência de infraestrutura (stack web/self-hosted):** O KCC é executado em um container Docker dedicado. Antes da primeira conversão, instale o Docker e construa a imagem: `pnpm kcc:build`. Para o preview de MOBI no navegador (extração de paginas), construa também: `pnpm mobi:build`. Formato KFX foi removido (requer Kindle Previewer, fora de escopo). O app desktop **não** usa essas dependências — o runtime completo (PostgreSQL, Python + KCC + kindlegen, extract_mobi) é embutido via `pnpm desktop:prepare:runtime`.

> **App desktop (`apps/desktop`):** Windows-only no 1º lançamento. Autossuficiente: no app empacotado o runtime completo vem embutido (PostgreSQL portable, Python 3.11 + KCC + kindlegen + extract_mobi), sem Docker/Redis/Postgres/Node no host. O backend é spawnado pelo processo main (Electron) com env controlado e settings persistidas em `%APPDATA%/MangaInk Agent/settings.json` (porta, `JWT_SECRET` gerado). Em dev, `pnpm desktop:dev:embedded` roda com `MI_EMBEDDED_MODE=1` e o runtime embutido (requer `pnpm desktop:prepare:runtime` + backend compilado via `pnpm build:backend`); `MI_EMBEDDED_MODE=0` força infra do host (debug). Sem runtime, o app exibe as telas de status `postgres_failed`/`migration_failed`/`backend_failed`.

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
│   │   │   │   ├── providers/     (EngineBadge, ProviderConfigDialog, ProviderEditorForm, constants)
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
│   │   │   │   ├── health/       (controller + routes)
│   │   │   │   ├── scraping/     (providers, interfaces, rate-limit, services, workers, use-cases, tests)
│   │   │   │   └── conversion/   (controllers, use-cases, services, repositories, workers, tests)
│   │   │   └── shared/
│   │   │       ├── config/       (env.ts — Zod env vars)
│   │   │       ├── database/     (prisma.ts — singleton)
│   │   │       ├── http/         (http-client.ts — axios + retry)
│   │   │       ├── redis/        (redis.ts singleton, bullmq.ts queue factory)
│   │   │       ├── middlewares/  (verify-jwt.ts)
│   │   │       ├── utils/        (filesystem, hash, id-generator, url-normalizer)
│   │   │       └── server.ts     (plugins, CORS, JWT, Swagger)
│   │   ├── prisma/
│   │   │   └── migrations/
│   │   ├── storage/              (cache de scraping + saída de conversões)
│   │   │   ├── sources/          (sourceId/ → metadata.json + covers/ + chapters/)
│   │   │   └── conversions/      (convId/ → config.json + status.json + logs/ + jobs/)
│   │   ├── package.json          (@mangaink/backend)
│   │   └── tsconfig.json
│   │
│   ├── desktop/                  ← App desktop Electron (Windows-only, shell)
│   │   ├── src/
│   │   │   ├── main/             (index.ts, backend-manager.ts, app-protocol.ts, settings-store.ts, status-screen.ts + status-screen/index.html, postgres-manager.ts, embedded-mode.ts)
│   │   │   ├── preload/          (index.ts, desktop-api.ts — window.desktop via contextBridge)
│   │   │   └── tests/            (settings-store, backend-manager, app-protocol, status-screen, postgres-manager, embedded-mode, preload + e2e/smoke)
│   │   ├── scripts/              (prepare-backend.mjs, prepare-frontend.mjs, prepare-runtime.mjs, runtime-manifest.json, patch_mobi_cover_runtime.py, generate-icon.mjs, after-pack.mjs, run-e2e.mjs)
│   │   ├── electron-builder.yml  (appId com.mangaink.desktop, NSIS + portable x64)
│   │   ├── build/icon.ico        (ícone pop-art gerado)
│   │   ├── resources/            (backend/ + frontend/ + runtime/ — gerados via prepare, gitignored)
│   │   ├── electron.vite.config.ts
│   │   ├── vitest.config.ts
│   │   └── package.json          (@mangaink/desktop)
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
│   ├── source_inspect_spec.md    (especificação técnica do scraping)
│   ├── fluxo-conversao-frontend.md
│   ├── fluxo-conversao-custom.md
│   └── openspec/
│       ├── archive/auth/         (design, spec, proposal, tasks)
│       ├── archive/scraping/     (design, spec, tasks)
│       ├── archive/conversions-job/ (design, proposal, spec, tasks)
│       ├── archive/limit-rating/    (design, proposal, spec, tasks)
│       └── changes/auth/         (config de alterações)
│
├── docker-compose.yml            (PostgreSQL + Redis)
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
- **cheerio** (parsing HTML para scraping)
- **axios** + **axios-retry** (HTTP client com retry automático)
- **bottleneck** (rate limiting por provider — controle de concorrência e throttling)
- **ioredis** (Redis — locks distribuídos e Pub/Sub)
- **BullMQ** (filas de processamento assíncrono)
- **Arquitetura modular:** controllers → use-cases → repositories → entities
- **Testes:** Vitest unitários + E2E com in-memory + mock repositories

### Prisma Schema

Modelo `Provider` (tabela `providers`, migração `add_providers` — MEC-31) alimenta os endpoints e a página `/fontes`:

| Campo | Tipo | Observação |
| --- | --- | --- |
| `id` | UUID pk | `@default(dbgenerated("gen_random_uuid()")) @db.Uuid` |
| `slug` | `@unique @db.VarChar(50)` | identifica o provider na URL |
| `name` | `@db.VarChar(100)` | nome de exibição |
| `engine` | `@db.VarChar(20)` | `api` / `cheerio` / `playwright` |
| `tags` | `String[] @db.Text` | `TEXT[]` Postgres |
| `status` | `@default("active") @db.VarChar(20)` | `active` / `slow` / `beta` / `offline` / `soon` |
| `description` | `Text?` | |
| `urlExample` | `@db.VarChar(2048)? @map("url_example")` | |
| `homepage` | `@db.VarChar(2048)?` | |
| `searchUrl` | `@db.VarChar(2048)? @map("search_url")` | |
| `rateLimitMaxConcurrent` | `Int @default(6) @map("rate_limit_max_concurrent")` | |
| `rateLimitMinTime` | `Int @default(50) @map("rate_limit_min_time")` | |
| `rateLimitReservoir` | `Int? @map("rate_limit_reservoir")` | |
| `rateLimitReservoirRefreshInterval` | `Int? @map("rate_limit_reservoir_refresh_interval")` | |
| `createdAt` / `updatedAt` | `DateTime @default(now()) @db.Timestamptz` | `updatedAt` com `@updatedAt` |

`allowedDomains` e `urlPattern` ficam no código (segurança), não no banco. `@@map("providers")`; colunas em snake_case via `@map`.

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
pnpm build:backend # Build de produção do backend
pnpm desktop:dev   # Frontend Vite + Electron em dev (janela desktop com backend spawnado)
pnpm desktop:dev:embedded # Igual ao desktop:dev, mas roda em modo embedded — Postgres/KCC/kindlegen embutidos, SEM Docker/Redis (requer pnpm desktop:prepare:runtime + backend compilado via pnpm build:backend)
pnpm desktop:build # Build do desktop (electron-vite: main + preload)
pnpm desktop:prepare:backend # Prepara o bundle backend embutido (build + pnpm deploy → resources/backend)
pnpm desktop:prepare:runtime # Baixa/valida SHA256/extrai Postgres+Python+KCC+kindlegen em apps/desktop/resources/runtime/ (gitignored)
pnpm desktop:dist   # Cadeia completa: frontend build → prepare backend → empacota NSIS + portable (apps/desktop/dist)
pnpm lint          # ESLint em todos os pacotes
pnpm format        # Prettier em todos os pacotes
pnpm test          # Testes do backend (Vitest)
pnpm db:migrate    # Executa migrations do Prisma
pnpm db:generate   # Regenera o Prisma Client (necessário após mudar o schema)
pnpm db:push       # Push do schema sem migration
pnpm db:studio     # Prisma Studio (GUI do banco)
pnpm storybook     # Storybook em http://localhost:6006
pnpm docker:up     # docker compose up -d (PostgreSQL + Redis)
pnpm docker:down   # docker compose down
pnpm kcc:build     # Build da imagem Docker do KCC (mangaink-kcc:10.3.0)
pnpm mobi:build     # Build da imagem Docker do extrator de MOBI (mangaink-unpack:0.4.1)
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
pnpm db:generate   # prisma generate
pnpm db:push       # prisma db push
pnpm db:studio     # prisma studio
```

### Dentro de `apps/desktop`

```bash
pnpm dev           # electron-vite dev (janela com backend spawnado)
pnpm build         # electron-vite build (main + preload → out/)
pnpm test          # vitest run (unitários)
pnpm test:e2e      # smoke Playwright Electron (requer pnpm desktop:dist antes; MI_SMOKE_FULL=1 opcional com Docker)
pnpm icon          # gera build/icon.ico (PNG pop-art → ICO)
pnpm prepare:runtime # Prepara o runtime embutido (download + SHA256 + extração → resources/runtime)
pnpm dist          # prepare frontend + electron-vite build + electron-builder (NSIS + portable)
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
| `src/routes/fontes.tsx`           | `/fontes` — Página real dos providers (busca, filtros, layout compacto) |
| `src/routes/configuracoes.tsx`    | `/configuracoes` — Configurações                   |
| `src/routes/perfil.tsx`           | `/perfil` — Perfil do usuário                      |

> **Importante:** O arquivo `src/routeTree.gen.ts` é gerado automaticamente. Não editar manualmente. Rode `pnpm dev` para regenerar ao criar novas rotas.

---

## API Endpoints

### Autenticação

- `POST /auth/register` — Registro de novo usuário
- `POST /auth/login` — Login, retorna `{ token }`
- `GET /users/me` — Perfil do usuário autenticado (requer Bearer token)
- `PATCH /users/me` — Atualiza perfil do usuário

### Scraping de Fontes

- `POST /api/conversions/source/inspect` — Dispara inspeção assíncrona de uma URL
  - Body: `{ url: string }`, Query: `?refresh=true` (opcional, força novo scraping)
  - Retorna: `{ sourceId, status: "processing" | "ready" }`
  - `200` se cache válido, `202` se job enfileirado
- `GET /api/conversions/source/inspect/:sourceId` — Retorna metadados completos da obra
  - Response: `{ sourceId, status, provider, source, metadata, chapters, covers, statistics }`
- `GET /api/conversions/source/inspect/:sourceId/events` — SSE com progresso do scraping
  - Eventos: `progress` (stage, message, progress%), `completed`, `failed`
- `GET /api/conversions/source/providers` — Lista providers disponíveis (público)
  - Envelope `{ providers: [...] }`, shape: `{ slug, name, engine: "api"|"cheerio"|"playwright", tags, status, description, urlExample, homepage, searchUrl, rateLimit: { maxConcurrent, minTime, reservoir, reservoirRefreshInterval } }`
  - `allowedDomains` **não** é exposto (SSRF protection é interna)
- `PATCH /api/conversions/source/providers/:slug` — Atualiza um provider (JWT obrigatório)
  - Body parcial (todos os campos opcionais): `status` (`active|slow|beta|offline|soon`), `description`, `urlExample`, `homepage`, `tags`, `searchUrl`, `rateLimit` (`maxConcurrent ≥ 1`, `minTime ≥ 0`, `reservoir ≥ 1` nullable, `reservoirRefreshInterval ≥ 100` nullable)
  - Persiste no banco, propaga a nova config de rate limit ao `ProviderResolver` (reconstrói strategies) e retorna o `provider` atualizado (shape acima). `404` se o slug não existir.

### Fluxo de Inspeção

O scraping é **assíncrono**: o POST enfileira um job BullMQ e retorna imediatamente.
O frontend acompanha o progresso via SSE e busca o resultado final via GET.

```text
POST /inspect → cache hit? → 200 { ready }
              → cache miss? → enfileira job → 202 { processing }
                              → SSE /events → completed → GET /inspect/:id
```

### Conversão de Obras

- `GET /api/conversions/options` — Catálogo de opções (devices, formats, fields, presets). Público.
  - `batchSplit` e `fileFusion` são internos — nunca aparecem na resposta
- `POST /api/conversions` — Cria uma Conversion via Planner
  - Body: `{ sourceId, cover, output, metadata, books: [{title, chapters, cover?}], options }`
  - Retorna 202 com `{ conversionId, totalJobs, status: "queued" }`
- `GET /api/conversions/:conversionId` — Status agregado (syncStatus em tempo real)
  - Response: `{ status, progress, totalJobs, completedJobs, failedJobs, runningJobs, pendingJobs, jobs[] }`
- `GET /api/conversions/:conversionId/events` — SSE fan-in de todos os Jobs
- `DELETE /api/conversions/:conversionId` + `POST .../cancel` — Cancelamento

### Preview de MOBI no Navegador

Leitura de volumes `.mobi` no navegador via extração assincrona de paginas em `/temp/` (TTL 24h), preservando os índices (ordem do spine) do MOBI original. As imagens sao extraídas por um container dedicado (`mangaink-unpack:0.4.1`) seguindo o mesmo padrão do KCC — backend fica em Node; apenas a extração roda em `docker run --rm`.

- `POST /api/conversions/:conversionId/jobs/:jobId/preview` — Inicia extração (idempotente)
  - `200` se cache /temp/ válido: `{ status: "ready", totalPages, cached: true }`
  - `202` se job enfileirado: `{ status: "processing", cached: false }`
- `GET /api/conversions/:conversionId/jobs/:jobId/preview` — Status agregado para poll
  - Response: `{ status: "queued"|"extracting"|"ready"|"failed", totalPages, readyPages, cacheUntil, error? }`
- `GET /api/conversions/:conversionId/jobs/:jobId/preview/pages/:index` — Stream da página
  - `200` com `image/*` (`Cache-Control: public, max-age=86400, immutable`)
  - `425` se a página ainda não foi escrita em disco: `{ error, readyPages, totalPages }`

---

## Variáveis de Ambiente

| Variável       | Descrição                          | Padrão                    |
|----------------|------------------------------------|---------------------------|
| `NODE_ENV`     | Ambiente (dev/test/production)     | `dev`                     |
| `PORT`         | Porta do servidor Fastify          | `3333`                    |
| `JWT_SECRET`   | Chave secreta JWT                  | (obrigatório)             |
| `DATABASE_URL` | URL de conexão PostgreSQL          | (obrigatório)             |
| `MI_EMBEDDED_MODE` | Modo embedded do backend (infra in-process, sem Redis/Docker/BullMQ). `1`/`true` ativa | `false` |
| `MI_EMBEDDED_RUNTIME_PATH` | Raiz do runtime embutido (Postgres/Python/KCC/kindlegen/extract_mobi). O desktop injeta automaticamente no backend spawnado (`{resources}/runtime` no packaged, `apps/desktop/resources/runtime` em dev) | (opcional) |
| `REDIS_URL`    | URL de conexão Redis (ignorado em `MI_EMBEDDED_MODE=1`) | `redis://localhost:6379`  |
| `STORAGE_PATH` | Diretório raiz para cache local    | `./storage`               |
| `KCC_DOCKER_IMAGE` | Imagem Docker do KCC (executada via `docker run`) | `mangaink-kcc:10.3.0` |
| `CONVERSIONS_STORAGE_PATH` | Diretório raiz para saída de conversões | `./storage/conversions` |
| `MOBI_DOCKER_IMAGE` | Imagem Docker do extrator de MOBI (preview no navegador) | `mangaink-unpack:0.4.1` |
| `MOBI_PREVIEW_TTL_SEC` | TTL (segundos) do cache de preview MOBI em /temp/ | `86400` (24h) |
| `JOB_STATUS_TTL_SEC` | TTL (segundos) do Hash Redis para status live de Jobs | `21600` (6h) |

> **Rate limit:** as 8 env vars `RATE_LIMIT_*` foram **removidas** (MEC-31). O rate limit agora é **DB-fed**: persistido no model `Provider` (`rateLimitMaxConcurrent`, `rateLimitMinTime`, `rateLimitReservoir?`, `rateLimitReservoirRefreshInterval?`), carregado no boot por `initProviders()` e editável via PATCH `/api/conversions/source/providers/:slug`. Defaults: `maxConcurrent=6`, `minTime=50`.

---

## Autenticação

Autenticação JWT real via backend Fastify, protegida pelo middleware `verify-jwt.ts`.
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
- `src/components/providers/` — `EngineBadge` (badge de engine), `ProviderConfigDialog` (modal de edição em `/fontes`), `ProviderEditorForm` (form compartilhado de edição), `constants` (`STATUS_CONFIG`, `SourceStatus`)
- `src/components/theme/` — `ThemeSelector`, `ComicIntensitySlider`, `ThemeToggle`
- `src/components/notifications/` — `ComicToast`, `NotificationBell`
- `src/components/onboarding/` — `OnboardingOverlay`

### Backend

- `src/app.ts` — entry point, inicia o servidor Fastify
- `src/shared/server.ts` — criação e configuração do servidor (plugins, CORS, JWT, Swagger)
- `src/shared/config/env.ts` — parse e validação das env vars (Zod) — inclui `REDIS_URL`, `STORAGE_PATH`
- `src/shared/database/repositories/index.ts` — composer de repositórios: factories `getSourceRepository()`, `getConversionRepository()`, `getConversionJobRepository()` que instanciam diretamente os adapters Prisma (Postgres é o único backend de persistência)
- `src/shared/http/http-client.ts` — cliente HTTP com axios + retry automático e backoff exponencial
- `src/shared/infra/` — contratos de infraestrutura desacoplados de Redis/BullMQ: `IQueueService`, `IPubSub`, `IJournalStore`, `IStatusStore`, `ILockService` (re-export em `index.ts`). Implementações em `redis/` (adapters BullMQ/ioredis — modo web) e `inmemory/` (fila in-process + EventEmitter + Map com TTL — modo embedded). `factory.ts` expõe `createRuntimeAdapters()` (seleciona por `env.MI_EMBEDDED_MODE`) e `queue-worker.ts` expõe `startQueueWorker()` (abstrai Worker BullMQ vs fila in-memory)
- `src/shared/redis/redis.ts` — singleton Redis (ioredis) para locks e Pub/Sub — **modo web apenas**
- `src/shared/redis/bullmq.ts` — factory de filas BullMQ com configurações padrão — **modo web apenas**
- `src/shared/middlewares/verify-jwt.ts` — middleware de autenticação JWT
- `src/shared/utils/filesystem.ts` — utilitários de I/O: `mkdirp()`, `writeJson()`, `readJson()`, `pathExists()`
- `src/shared/utils/hash.ts` — `sha256()` para geração de IDs determinísticos
- `src/shared/utils/id-generator.ts` — `createSourceId()`, `createChapterId()`, `createCoverId()`, `createJobId()`, `createConversionId()`
- `src/shared/utils/url-normalizer.ts` — `normalizeUrl()`: remove tracking params, fragmentos, garante barra final

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

- **`scraping/`** — Scraping de fontes online (mangás)
  - `scraping.routes.ts` — 5 endpoints: POST /inspect, GET /inspect/:id, GET /inspect/:id/events (SSE), GET /providers (público), PATCH /providers/:slug (JWT)
  - `controllers/` — `inspect-source.controller.ts`, `preview-source.controller.ts`, `source-events.controller.ts`, `providers.controller.ts` (list/update a partir do banco)
  - `use-cases/` — `inspect-source.use-case.ts` (fluxo: normalizar URL → resolver provider → gerar sourceId → cache check → lock → enfileirar), `get-source.use-case.ts`
  - `services/` — `cache.service.ts` (TTL de 24h), `inspect-queue.service.ts` (BullMQ), `redis-lock.service.ts` (lock distribuído via Redis SET NX EX), `redis-pubsub.service.ts` (Pub/Sub para SSE), `source-events.service.ts` (bridge Redis → SSE)
  - `interfaces/` — `provider-strategy.interface.ts` (interface `IProviderStrategy` com `inspect()`, `getChapterImages()`, `downloadImage()`, `rateLimiter`)
  - `providers/` — `known-providers.ts` (fonte de verdade estática do seed), `known-providers.types.ts` (`ProviderRecord`, `ProviderSeed`), `init-providers.ts` (`initProviders()` chamado no boot — upsert dos providers no banco, carrega rate limits no registry e reconstrói o resolver; chamado dentro de try/catch no `server.ts`, com fallback para `known-providers.ts`), `provider-resolver.ts` (singleton, resolve provider por URL + injeta `RateLimiter`), `provider.interface.ts` (deprecated re-export `ScrapingProvider`), `mangalivre/` (implementação Cheerio: `MangaLivreStrategy`, parser com `parseChapterImages()` + `stripResolutionSuffix()`, selectors), `imperiodabritannia/` (implementação API: `ImperioDaBritanniaStrategy`, mapper com `mapObraToInspectResponse()` + `mapCapituloToImageUrls()`, tipos da API externa), `mangasbrasuka/` (implementação API: `MangasBrasukaStrategy`, mapper com `mapObraToInspectResponse()` + `mapPaginasToImageUrls()`, tipos da API externa)
  - `repositories/` — `provider.repository.ts` (interface: `findAll`, `findBySlug`, `upsertFromSeed`, `update`), `prisma-provider.repository.ts` (implementação Prisma do model `Provider`), além de `source-cache.repository.ts` (interface) e `filesystem-source.repository.ts`
  - `use-cases/` — `list-providers.use-case.ts`, `update-provider.use-case.ts` (validação Zod + refresh do registry após update)
  - `rate-limit/` — `types.ts` (`RateLimiterConfig = { maxConcurrent, minTime, reservoir?, reservoirRefreshInterval? }`, `RateLimiter`), `rate-limiter.ts` (`createRateLimiter()` factory Bottleneck), `rate-limit-registry.ts` (**DB-fed**: `loadFromProviders(configs)` alimenta o registry a partir do banco; **sem** env vars `RATE_LIMIT_*`; defaults constantes `maxConcurrent=6`, `minTime=50`)
  - `repositories/` — `source-cache.repository.ts` (interface), `filesystem-source.repository.ts` (implementação filesystem com `storage/sources/{sourceId}/metadata.json`)
  - `workers/` — `inspect-source.worker.ts` (BullMQ worker: scraping → Pub/Sub progress → salva metadata.json)
  - `types/` — `source.types.ts` (SourceInspectResponse, Chapter, Cover, MangaMetadata, ChapterImagesResult), `metadata.types.ts` (MetadataCache, SourceMetadataFile), `provider.types.ts` (ProviderEngine, ProviderInfo)
  - `errors/` — `scraping.errors.ts` (ProviderNotFoundError, InvalidUrlError, ScrapingNetworkError, ScrapingParseError, SourceNotFoundError)
  - `dtos/` — `inspect-source.dto.ts` (InspectSourceBody, InspectSourceQuery), `preview-source.dto.ts` (SourceParams)
  - `tests/` — Testes unitários (Vitest) + E2E + mock-scraping-provider

  **Convenções importantes do módulo de scraping:**
  - A interface principal é `IProviderStrategy` (em `interfaces/`). `ScrapingProvider` é um re-export deprecated.
  - Todo provider implementa `IProviderStrategy` e recebe um `RateLimiter` (Bottleneck) via constructor.
  - `downloadImage()` encapsula chamadas HTTP de download com rate limiting. O `ImageDownloaderService` chama `provider.downloadImage()` em vez de `httpClient.get()`.
  - Rate limits são **persistidos no banco** (model `Provider`), carregados no boot por `initProviders()` e editáveis via PATCH `/api/conversions/source/providers/:slug`. Sem env vars `RATE_LIMIT_*` (removidas). Defaults: `maxConcurrent=6`, `minTime=50`.
  - O `ProviderResolver` injeta automaticamente o `RateLimiter` no constructor do provider (Composition Root).
  - Adicionar novo provider: criar classe `implements IProviderStrategy` + registrar no `known-providers.ts` (seed) + ajustar o model `Provider` no banco (rate limit via PATCH de providers).
  - **Providers disponíveis:** `mangalivre` (engine `cheerio`, HTML parsing), `imperiodabritannia` (engine `api`, API REST direta com headers `x-noencryptionbritta` e `X-API-Token`), `mangasbrasuka` (engine `api`, API REST pública em `app.mangasbrasuka.com.br` sem autenticação)

- **`conversion/`** — Conversão de mangás para formatos e-reader via KCC (Kindle Comic Converter)
  - `conversion.routes.ts` — 6 endpoints: GET /options, POST / (create), GET /:id, GET /:id/events (SSE fan-in), DELETE /:id e POST /:id/cancel
  - `mobi-preview.routes.ts` — 3 endpoints do preview MOBI: POST /preview (idempotente), GET /preview (status), GET /preview/pages/:index (stream)
  - `controllers/` — `conversion-options.controller.ts`, `create-conversion.controller.ts`, `get-conversion.controller.ts`, `conversion-events.controller.ts`, `cancel-conversion.controller.ts`, `mobi-preview.controller.ts` (start/status/page do preview MOBI)
  - `use-cases/` — `create-conversion.use-case.ts` (Planner: validação, herança de capa, geração de Jobs), `get-conversion.use-case.ts`, `get-conversion-options.use-case.ts`, `cancel-conversion.use-case.ts`, `mobi-preview.use-case.ts` (StartMobiPreviewUseCase, GetMobiPreviewStatusUseCase, GetMobiPreviewPageUseCase + interface `MobiPreviewQueue`)
  - `services/` — `conversion-queue.service.ts` (BullMQ), `conversion-pubsub.service.ts` (Pub/Sub com `subscribeMany()`, `rpush`, `lrange`, `incr`), `conversion-events.service.ts` (bridge Redis → SSE fan-in com replay de eventos via journal), `image-downloader.service.ts` (download via `provider.downloadImage()` com validação de magic bytes — concorrência controlada pelo Bottleneck do provider), `placeholder.service.ts` (geração de PNG placeholder via sharp), `kcc-runner.service.ts` (impl docker: spawn do KCC via `docker run mangaink-kcc:10.3.0` — bind mounts `/input:ro` e `/output`, paths do container nas flags KCC; `--user` aplicado apenas em Linux), `kcc-runner-embedded.service.ts` (impl embedded: spawn `python.exe <runtime>/kcc/kcc-c2e.py` com `PYTHONPATH=<runtime>/kcc` e `<runtime>/kindlegen` no PATH do child — sem Docker), `kcc-runner.factory.ts` (`createKccRunner()` seleciona por `MI_EMBEDDED_MODE`, paths via `MI_EMBEDDED_RUNTIME_PATH`), `mobi-preview.service.ts` (resolução paths /temp/<file-base>/, TTL `MOBI_PREVIEW_TTL_SEC` por mtime do index.json, leitura/contagem de paginas), `mobi-unpack-runner.service.ts` (impl docker: spawn `docker run mangaink-unpack:0.4.1` — bind mounts `/input.mobi:ro` e `/output`, poll images/ a cada 250ms chamando onTick), `mobi-unpack-runner-embedded.service.ts` (impl embedded: spawn `python.exe <runtime>/extract_mobi.py` — sem Docker), `mobi-unpack-runner.factory.ts` (`createMobiUnpackRunner()` seleciona por `MI_EMBEDDED_MODE`), `mobi-preview-queue.service.ts` (fila BullMQ `mobi-preview`)
  - `repositories/` — `conversion.repository.ts` (interface), `prisma-conversion.repository.ts` (impl Prisma com `syncStatus()` — em modo embedded consome o status store do runtime via `JobLiveStatusStore`, a MESMA instância `IStatusStore` compartilhada com workers e cancelamento), `filesystem-conversion.repository.ts` (com `syncStatus()`), `conversion-job.repository.ts` + `filesystem-job.repository.ts` (com `withConversion()` scoping)
  - `workers/` — `conversion-job.worker.ts` (BullMQ: download → hard links → ComicInfo.xml → cover → KCC → packaging), `mobi-preview.worker.ts` (BullMQ: clearTemp → status extracting → runner.run + onTick → ready/failed; `processMobiPreviewJob` isolado para testes; `startMobiPreviewWorker` instancia o Worker com deps de produção)
  - `config/` — `devices.ts`, `formats.ts`, `fields.ts`, `presets.ts`, `kcc-flag-mapper.ts` (mapeia opções semânticas → flags CLI do KCC)
  - `types/` — `conversion.types.ts` (ConversionConfig, Book, JobMetadata, ConversionJobSummary, etc.), `mobi-preview.types.ts` (MobiPreviewLiveStatus, MobiPreviewIndex, MobiPreviewPage, …)
  - `errors/` — `conversion.errors.ts` (ConversionNotFoundError, InvalidConversionStateError, DuplicateChapterError, ForbiddenError, KccExecutionError, DownloadFailedError, etc.), `mobi-preview.errors.ts` (PreviewNotReadyError, InvalidPageIndexError, NotAMobiJobError, MobiFileNotFoundError, MobiExtractionError)
  - `dtos/` — `create-conversion.dto.ts`, `conversion-options.dto.ts`, `conversion-params.dto.ts`, `mobi-preview.dto.ts` (params + page params + response schemas)
  - `tests/` — testes (unit + E2E + helpers: in-memory repo, mock queue, mock events, mock job, fixtures)
  - `shared/redis/mobi-preview-status-store.ts` — Redis Hash para estado live do preview MOBI (reusa `JOB_STATUS_TTL_SEC`)

  **Convenções importantes do módulo de conversão:**
  - `batchSplit` e `fileFusion` são internos do Planner — NUNCA expostos na API pública
  - O Worker escreve `ComicInfo.xml` no diretório de input do KCC com título, autor, série e gêneros do scraping para metadados corretos no EPUB
  - `metadataTitle: 'metadataOnly'` é forçado no Worker quando ComicInfo.xml está presente
  - URLs de capa têm sufixo de resolução WordPress (`-WxH`) removido via `stripResolutionSuffix()` no parser — `mangalivre.parser.test.ts`
  - Tratamento de erros é centralizado no error handler global do Fastify (`server.ts`): erros de domínio (`ConversionError`) são mapeados por `error.code` → HTTP status (403/404/409/400/425/500). Controllers **não** usam try/catch para erros de domínio.
  - Toda conversão tem `userId` em `ConversionConfig` (salvo em `config.json`). Use-cases validam ownership antes de acessar qualquer conversão. Isso vale também para os endpoints de preview MOBI.
  - Eventos SSE são persistidos em Redis List (`conversion-journal:{jobId}`) com ID monotônico (`INCR`). O `connectConversionToSSE()` faz replay automático do journal para clientes que conectam tardiamente.
  - Imagens baixadas são validadas via magic bytes (JPEG, PNG, WEBP, GIF, BMP). Páginas corrompidas são detectadas e tratadas conforme `errorHandlingStrategy`:
    - `ignore`: substitui por placeholder (PNG gerado via sharp na resolução do dispositivo)
    - `skip_chapter`: pula o capítulo
    - `abort`: cancela o job
  - Metadados de placeholders são persistidos em `images.json` no diretório de cache do capítulo para reportar páginas faltantes mesmo em cache hits.
  - Progresso de conversão persiste entre navegações: ao re-navegar, `processedChapters` é computado a partir dos jobs completed via GET + SSE journal replay.
  - Preview MOBI no navegador: cache em `/temp/<file-base>/` ao lado do MOBI, TTL por `MOBI_PREVIEW_TTL_SEC` (24h) medido pelo mtime do `index.json`. Extracao roda em container dedicado `mangaink-unpack`. `PREVIEW_NOT_READY` → HTTP 425 com `{ readyPages, totalPages }` para o cliente refazer o fetch. Plan-first: o script Python escreve `index.json` antes das imagens para o Node worker anunciar totalPages cedo (primeira página disponível já libera o frontend).

### Desktop (Electron)

- `src/main/index.ts` — janela (`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`), single-instance, boot do backend e lifecycle
- `src/main/embedded-mode.ts` — `resolveEmbeddedMode()`: modo embedded por padrão no app empacotado; `MI_EMBEDDED_MODE=0` força infra do host (debug). Em dev, `pnpm desktop:dev:embedded` roda com `MI_EMBEDDED_MODE=1` + `desktop:prepare:runtime` habilita embedded.
- `src/main/postgres-manager.ts` — PostgreSQL portable do runtime: `initdb` condicional (1ª execução), `pg_ctl` start/stop com porta livre, `createdb` garantido, `psql` readiness poll
- `src/main/backend-manager.ts` — spawn/env/health/kill do backend compilado; estados `idle | starting | postgres_failed | migration_failed | backend_failed | ready` (embedded) e `prereq_failed` (infra do host). No packaged, backend e migrations são spawnados via `process.execPath` + `ELECTRON_RUN_AS_NODE=1` (sem Node no host); em dev, `node` do PATH. No modo embedded injeta `MI_EMBEDDED_RUNTIME_PATH` no env do backend (dep `runtimePath` — resolvida pelo main)
- `src/main/app-protocol.ts` — proxy `app://`: `/api|/auth|/users/*` → backend via `net.fetch`; estáticos → `resources/frontend/`
- `src/main/settings-store.ts` — `settings.json` em `%APPDATA%/MangaInk Agent/` (porta, jwtSecret; `databaseUrl`/`redisUrl` ignorados no modo embedded, `managedPostgresPort` persistido)
- `src/preload/` — expõe `window.desktop` (getStatus/retry/openLogs/openExternal/getVersion) via `contextBridge`
- `resources/runtime/` — runtime embutido (PostgreSQL portable + Python 3.11 + KCC + kindlegen + extract_mobi), materializado por `pnpm desktop:prepare:runtime` (download + SHA256 + extração; gitignored)
- Backend embedded: env controlado (JWT_SECRET gerado, `OTEL_SDK_DISABLED=true`, `MI_DESKTOP_MANAGED=1`, `MI_EMBEDDED_MODE=1` + `MI_EMBEDDED_RUNTIME_PATH` no modo embedded); `desktop:dist` materializa `node_modules` no pacote via `after-pack.mjs`

---

## Armazenamento de arquivos

Os arquivos baixados (cache de scraping) e gerados (saída da conversão, logs e preview MOBI) vivem sob a raiz definida por `STORAGE_PATH`. Na stack web self-hosted a raiz default é `apps/backend/storage` (`./storage`); no app desktop (modo embedded e portable) ela é `%APPDATA%/MangaInk Agent/storage`, definida pelo main do Electron (`storagePath: join(app.getPath('userData'), 'storage')` com `userData = %APPDATA%/MangaInk Agent`).

```
<raiz STORAGE_PATH>/
├── sources/{sourceId}/           cache de scraping
│   ├── metadata.json             metadados da obra (inspect)
│   ├── covers/                   capas baixadas
│   └── chapters/{chapterId}/     imagens baixadas por capítulo
├── conversions/{conversionId}/   saída de conversão
│   ├── config.json               config da conversão (userId, options, books)
│   ├── status.json               status agregado persistido
│   ├── logs/conversion.log       log da conversão
│   └── jobs/{jobId}/
│       └── output/{título}.{ext} arquivo final (EPUB/MOBI/CBZ)
└── temp/{file-base}/             cache de preview MOBI no navegador (TTL `MOBI_PREVIEW_TTL_SEC`, default 24h)
```

No desktop, `temp/` também vive dentro de `%APPDATA%/MangaInk Agent/storage/`. Além do storage, `%APPDATA%/MangaInk Agent/` contém:

- `settings.json` — porta, `JWT_SECRET` gerado, `managedPostgresPort`
- `pgdata/` — data dir do PostgreSQL portable

Logs do processo backend ficam em memória (`getLogs()`); `desktop:open-logs` abre o diretório `userData`.

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
