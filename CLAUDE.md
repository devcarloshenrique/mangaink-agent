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
│   │   │   │   ├── health/       (controller + routes)
│   │   │   │   ├── scraping/     (providers, services, workers, use-cases, tests)
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
- **ioredis** (Redis — locks distribuídos e Pub/Sub)
- **BullMQ** (filas de processamento assíncrono)
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
pnpm docker:up     # docker compose up -d (PostgreSQL + Redis)
pnpm docker:down   # docker compose down
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
- `GET /api/conversions/source/providers` — Lista providers disponíveis

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

---

## Variáveis de Ambiente

| Variável       | Descrição                          | Padrão                    |
|----------------|------------------------------------|---------------------------|
| `NODE_ENV`     | Ambiente (dev/test/production)     | `dev`                     |
| `PORT`         | Porta do servidor Fastify          | `3333`                    |
| `JWT_SECRET`   | Chave secreta JWT                  | (obrigatório)             |
| `DATABASE_URL` | URL de conexão PostgreSQL          | (obrigatório)             |
| `REDIS_URL`    | URL de conexão Redis               | `redis://localhost:6379`  |
| `STORAGE_PATH` | Diretório raiz para cache local    | `./storage`               |
| `KCC_BIN_PATH` | Caminho para o binário do KCC      | `bin/kcc/windows/kcc_c2e_10.3.0.exe` |
| `CONVERSIONS_STORAGE_PATH` | Diretório raiz para saída de conversões | `./storage/conversions` |

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
- `src/components/fontes/` — `SuggestSourceForm`
- `src/components/theme/` — `ThemeSelector`, `ComicIntensitySlider`, `ThemeToggle`
- `src/components/notifications/` — `ComicToast`, `NotificationBell`
- `src/components/onboarding/` — `OnboardingOverlay`

### Backend

- `src/app.ts` — entry point, inicia o servidor Fastify
- `src/shared/server.ts` — criação e configuração do servidor (plugins, CORS, JWT, Swagger)
- `src/shared/config/env.ts` — parse e validação das env vars (Zod) — inclui `REDIS_URL`, `STORAGE_PATH`
- `src/shared/database/prisma.ts` — singleton do Prisma Client
- `src/shared/http/http-client.ts` — cliente HTTP com axios + retry automático e backoff exponencial
- `src/shared/redis/redis.ts` — singleton Redis (ioredis) para locks e Pub/Sub
- `src/shared/redis/bullmq.ts` — factory de filas BullMQ com configurações padrão
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
  - `scraping.routes.ts` — 4 endpoints: POST /inspect, GET /inspect/:id, GET /inspect/:id/events (SSE), GET /providers
  - `controllers/` — `inspect-source.controller.ts`, `preview-source.controller.ts`, `source-events.controller.ts`, `providers.controller.ts`
  - `use-cases/` — `inspect-source.use-case.ts` (fluxo: normalizar URL → resolver provider → gerar sourceId → cache check → lock → enfileirar), `get-source.use-case.ts`
  - `services/` — `cache.service.ts` (TTL de 24h), `inspect-queue.service.ts` (BullMQ), `redis-lock.service.ts` (lock distribuído via Redis SET NX EX), `redis-pubsub.service.ts` (Pub/Sub para SSE), `source-events.service.ts` (bridge Redis → SSE)
  - `providers/` — `provider.interface.ts` (interface `ScrapingProvider` com `getChapterImages()`), `provider-resolver.ts` (resolve provider por URL), `mangalivre/` (implementação Cheerio: parser com `parseChapterImages()` + `stripResolutionSuffix()`, provider, selectors)
  - `repositories/` — `source-cache.repository.ts` (interface), `filesystem-source.repository.ts` (implementação filesystem com `storage/sources/{sourceId}/metadata.json`)
  - `workers/` — `inspect-source.worker.ts` (BullMQ worker: scraping → Pub/Sub progress → salva metadata.json)
  - `types/` — `source.types.ts` (SourceInspectResponse, Chapter, Cover, MangaMetadata, ChapterImagesResult), `metadata.types.ts` (MetadataCache, SourceMetadataFile), `provider.types.ts` (ProviderEngine, ProviderInfo)
  - `errors/` — `scraping.errors.ts` (ProviderNotFoundError, InvalidUrlError, ScrapingNetworkError, ScrapingParseError, SourceNotFoundError)
  - `dtos/` — `inspect-source.dto.ts` (InspectSourceBody, InspectSourceQuery), `preview-source.dto.ts` (SourceParams)
  - `tests/` — Testes unitários (Vitest) + E2E + mock-scraping-provider

- **`conversion/`** — Conversão de mangás para formatos e-reader via KCC (Kindle Comic Converter)
  - `conversion.routes.ts` — 6 endpoints: GET /options, POST / (create), GET /:id, GET /:id/events (SSE fan-in), DELETE /:id e POST /:id/cancel
  - `controllers/` — `conversion-options.controller.ts`, `create-conversion.controller.ts`, `get-conversion.controller.ts`, `conversion-events.controller.ts`, `cancel-conversion.controller.ts`
  - `use-cases/` — `create-conversion.use-case.ts` (Planner: validação, herança de capa, geração de Jobs), `get-conversion.use-case.ts`, `get-conversion-options.use-case.ts`, `cancel-conversion.use-case.ts`
  - `services/` — `conversion-queue.service.ts` (BullMQ), `conversion-pubsub.service.ts` (Pub/Sub com `subscribeMany()`, `rpush`, `lrange`, `incr`), `conversion-events.service.ts` (bridge Redis → SSE fan-in com replay de eventos via journal), `image-downloader.service.ts` (download paralelo com validação de magic bytes), `placeholder.service.ts` (geração de PNG placeholder via sharp), `kcc-runner.service.ts` (spawn do KCC)
  - `repositories/` — `conversion.repository.ts` + `filesystem-conversion.repository.ts` (com `syncStatus()`), `conversion-job.repository.ts` + `filesystem-job.repository.ts` (com `withConversion()` scoping)
  - `workers/` — `conversion-job.worker.ts` (BullMQ: download → hard links → ComicInfo.xml → cover → KCC → packaging)
  - `config/` — `devices.ts`, `formats.ts`, `fields.ts`, `presets.ts`, `kcc-flag-mapper.ts` (mapeia opções semânticas → flags CLI do KCC)
  - `types/` — `conversion.types.ts` (ConversionConfig, Book, JobMetadata, ConversionJobSummary, etc.)
  - `errors/` — `conversion.errors.ts` (ConversionNotFoundError, InvalidConversionStateError, DuplicateChapterError, ForbiddenError, KccExecutionError, DownloadFailedError, etc.)
  - `dtos/` — `create-conversion.dto.ts`, `conversion-options.dto.ts`, `conversion-params.dto.ts`
  - `tests/` — testes (unit + E2E + helpers: in-memory repo, mock queue, mock events, mock job, fixtures)

  **Convenções importantes do módulo de conversão:**
  - `batchSplit` e `fileFusion` são internos do Planner — NUNCA expostos na API pública
  - O Worker escreve `ComicInfo.xml` no diretório de input do KCC com título, autor, série e gêneros do scraping para metadados corretos no EPUB
  - `metadataTitle: 'metadataOnly'` é forçado no Worker quando ComicInfo.xml está presente
  - URLs de capa têm sufixo de resolução WordPress (`-WxH`) removido via `stripResolutionSuffix()` no parser — `mangalivre.parser.test.ts`
  - Tratamento de erros é centralizado no error handler global do Fastify (`server.ts`): erros de domínio (`ConversionError`) são mapeados por `error.code` → HTTP status (403/404/409/400/500). Controllers **não** usam try/catch para erros de domínio.
  - Toda conversão tem `userId` em `ConversionConfig` (salvo em `config.json`). Use-cases validam ownership antes de acessar qualquer conversão.
  - Eventos SSE são persistidos em Redis List (`conversion-journal:{jobId}`) com ID monotônico (`INCR`). O `connectConversionToSSE()` faz replay automático do journal para clientes que conectam tardiamente.
  - Imagens baixadas são validadas via magic bytes (JPEG, PNG, WEBP, GIF, BMP). Páginas corrompidas são detectadas e tratadas conforme `errorHandlingStrategy`:
    - `ignore`: substitui por placeholder (PNG gerado via sharp na resolução do dispositivo)
    - `skip_chapter`: pula o capítulo
    - `abort`: cancela o job
  - Metadados de placeholders são persistidos em `images.json` no diretório de cache do capítulo para reportar páginas faltantes mesmo em cache hits.
  - Progresso de conversão persiste entre navegações: ao re-navegar, `processedChapters` é computado a partir dos jobs completed via GET + SSE journal replay.

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
