# MangaInk Desktop (Electron) — Design de Arquitetura

> **Status:** DRAFT
> **Data:** 2026-08-06

---

## 1. Motivação

O MangaInk Agent hoje exige que o usuário monte o ambiente manualmente (Node, Postgres, Redis, Docker, dois servidores). Uma versão desktop com o backend embedded e instalador Windows remove essa barreira para o público consumidor, mantendo a arquitetura existente (PostgreSQL + Redis + KCC via Docker) intacta no primeiro lançamento.

---

## 2. Decisões de Arquitetura

### D1 — Shell-only: desktop não duplica o renderer React

`apps/desktop` contém **apenas processo main + preload**. O renderer é o frontend existente:

- **Dev**: `BrowserWindow.loadURL('http://localhost:5173')` — Vite dev server com o proxy já configurado (`vite.config.ts` encaminha `/api`, `/auth`, `/users` para `localhost:3333`). Nenhuma mudança no proxy.
- **Prod**: `BrowserWindow.loadURL('app://bundle/index.html')` — protocolo customizado servindo o `dist/` do frontend.

**Justificativa:** mantém uma única fonte de verdade da UI (React), elimina divergência entre versões web/desktop e reduz o tamanho do app desktop a poucos arquivos. `electron-vite` é usado apenas para compilar main/preload (config do renderer omitida).

### D2 — Proxy de API no processo main via `protocol.handle` + `net.fetch`

No modo prod, o frontend faz `fetch('/api/...')` relativo — resolvido contra o host do protocolo `app://`. O handler do protocolo decide:

- Paths iniciando em `/api/`, `/auth/` ou `/users/` → encaminha para `http://127.0.0.1:{backendPort}{path}` via `net.fetch(url, { bypassCustomProtocolHandlers: true })` e retorna o corpo como `Response` (streaming preservado — SSE `/events` e streams de imagem funcionam sem buffer).
- Demais paths → servem arquivos estáticos de `{resourcesPath}/frontend/` (path traversal guardada).

**Justificativa:** `net.fetch` do Electron retorna um `ReadableStream` nativo (não bufferiza), ao contrário de `webRequest.onBeforeRequest` (redirect) que tem corner cases com streaming. `bypassCustomProtocolHandlers` evita loop infinito (a requisição ao backend não passa pelo nosso handler). O handler é exposto como factory pura (`createAppProtocolHandler(deps)`) para testes unitários com `net.fetch` mockado.

### D3 — Backend embedded: child process gerenciado pelo main

`BackendManager` (main):

```typescript
interface BackendManagerDeps {
  spawn: typeof childProcess.spawn
  fetch: typeof globalThis.fetch        // health poll
  settings: SettingsStore
  resourcesBackendPath: string          // {resources}/backend em prod, apps/backend em dev
  backendPort: () => Promise<number>
}
```

- **Spawn**: `node {backendPath}/dist/app.js` com `stdio: ['ignore', 'pipe', 'pipe']` (stdout/stderr logados pelo main).
- **Env herdada do main + overrides**:

| Variável | Valor no desktop |
|----------|------------------|
| `PORT` | `settings.backendPort` (default 3333) |
| `JWT_SECRET` | gerado na 1ª execução, persistido em settings |
| `DATABASE_URL` | `settings.databaseUrl` (default `postgresql://mangaink:mangaink@localhost:5432/mangaink_agent_db`) |
| `REDIS_URL` | `settings.redisUrl` (default `redis://localhost:6379`) |
| `STORAGE_PATH` | `{userData}/storage` |
| `CONVERSIONS_STORAGE_PATH` | `{userData}/storage/conversions` |
| `OTEL_SDK_DISABLED` | `true` (evita exporter OTLP gRPC falho no desktop) |
| `MI_DESKTOP_MANAGED` | `1` (habilita migrações no boot) |
| `MOBI_PREVIEW_TTL_SEC`, `JOB_STATUS_TTL_SEC`, `RATE_LIMIT_*` | defaults do env.ts (mantidos) |

- **Readiness**: poll `GET /api/health` a cada 500ms até `status === 'ok'` ou timeout (default 30s).
- **Kill**: no quit do app, `SIGTERM` → aguarda 5s → `SIGKILL` (garante ausência de processos órfãos; o backend já tem graceful shutdown em `SIGTERM`).
- **Restart**: método `restart()` usado pela tela de status (retry).

**Decisão (D3a):** o desktop **não** executa `docker compose up` automaticamente. Pré-requisitos do host (Docker + containers + imagens KCC) são verificados e diagnosticados na tela de status, mas a ação é manual — mesmo comportamento da stack web atual, com orientação clara (`pnpm docker:up`).

### D4 — Tela de status/pré-requisitos (HTML estático do main)

Enquanto o backend não está ready (ou falhou), a janela carrega uma página HTML embutida no main (`status-screen/index.html` — sem React, sem bundle). Estados:

| Estado | Condição | Ações |
|--------|----------|-------|
| `starting` | backend spawnado, aguardando health | — |
| `prereq_failed` | Docker ausente (`docker version` falhou) ou DB/Redis inacessíveis | "Reinstalar pré-requisitos" (docs), retry |
| `migration_failed` | `prisma migrate deploy` falhou | mostrar stderr, retry |
| `backend_failed` | child exitou antes do ready | mostrar stderr, retry |
| `ready` | health ok | troca para o frontend (`loadURL`) |

A tela comunica com o main via **preload IPC** (`window.desktop.getStatus()`, `window.desktop.retry()`, `window.desktop.openLogs()`). O frontend não é carregado até `ready`.

### D5 — Migrations no boot gerenciado

Com `MI_DESKTOP_MANAGED=1`, o **BackendManager** executa `prisma migrate deploy` (via `node {backendPath}/node_modules/prisma/build/index.js migrate deploy` ou o binário `prisma` do bundle) com `DATABASE_URL` do settings, **antes** do spawn da API. Falha → estado `migration_failed` com stderr na tela de status.

**Decisão (D5a):** executado pelo main (não dentro do `app.ts`) para não alterar o backend; a flag `MI_DESKTOP_MANAGED` deixa explícito que é o ambiente desktop. Alternativa rejeitada: adicionar bootstrap de migrations no `app.ts` (acoplaria o backend ao fluxo desktop).

### D6 — Empacotamento com electron-builder (Windows)

```yaml
# electron-builder.yml (resumo)
appId: com.mangaink.desktop
productName: MangaInk Agent
win:
  target: [nsis, portable]
  icon: build/icon.ico
nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
  shortcutName: MangaInk Agent
extraResources:
  - from: resources/backend    → backend/
  - from: resources/frontend   → frontend/
```

- `resources/backend/` é preparado pelo script `desktop:prepare:backend`:
  1. `pnpm --filter @mangaink/backend build` (tsc → `dist/`)
  2. `pnpm --filter @mangaink/backend deploy --prod --legacy` para `apps/desktop/resources/backend` (node_modules só de produção, seguindo workspace symlinks)
  3. Verificação: engine do Prisma (`@prisma/client/.prisma` + engine binária win), prebuild `sharp` (`node_modules/sharp/lib/...`), client gerado presente; smoke run `node dist/app.js --help`-like (ou `OTEL_SDK_DISABLED=true node -e "require('./dist/app')"` com timeout curto e expectativa de falha por DB — valida apenas a carga do módulo)
- `resources/frontend/` = `dist/` do `pnpm --filter @mangaink/frontend build`.
- Main resolve paths via `process.resourcesPath` em prod e `../../apps/{backend,frontend}` em dev (`app.isPackaged`).

**Decisão (D6a):** backend e frontend em `extraResources` (fora do asar) — evita problemas com módulos nativos (sharp, engines Prisma) e simplifica o spawn do `node`.

### D7 — Settings persistidos + IPC

`settings.json` em `app.getPath('userData')`:

```json
{
  "backendPort": 3333,
  "databaseUrl": "postgresql://mangaink:mangaink@localhost:5432/mangaink_agent_db",
  "redisUrl": "redis://localhost:6379",
  "jwtSecret": "<hex gerado na 1ª execução>"
}
```

- `SettingsStore` (factory pura + `writeJson`/`readJson` atômicos — reusa padrão de `shared/utils/filesystem.ts`).
- API exposta no preload: `window.desktop = { getStatus(), retry(), openLogs(), openExternal(url), getVersion() }` — **contextBridge**, sem expor Node ao renderer.

### D8 — Segurança e ciclo de vida

- `BrowserWindow` com `webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, preload }`
- `app.requestSingleInstanceLock()` — segunda instância foca a janela existente
- `webContents.setWindowOpenHandler` → `shell.openExternal` para `https?://` e deny para o resto
- `will-navigate` bloqueado para fora de `app://` / `localhost:5173` (dev)
- Quit: `backend.kill('SIGTERM')` → timeout 5s → `SIGKILL`; `before-quit` handler
- CSP meta no status screen (`default-src 'none'; style-src 'unsafe-inline'`) — o frontend web mantém as fontes Google Fonts atuais (precisa de rede de qualquer forma para scraping)

---

## 3. Estrutura de Arquivos

```
Criados:
├── apps/desktop/
│   ├── package.json                    (@mangaink/desktop — electron, electron-vite, electron-builder, vitest)
│   ├── electron.vite.config.ts         (main + preload apenas)
│   ├── electron-builder.yml
│   ├── tsconfig.json / tsconfig.node.json
│   ├── build/icon.ico                  (ícone gerado do tema comic)
│   ├── resources/backend/              (bundle preparado — gitignored)
│   ├── resources/frontend/             (dist do frontend — gitignored)
│   ├── scripts/prepare-backend.mjs     (desktop:prepare:backend)
│   └── src/
│       ├── main/
│       │   ├── index.ts                (app lifecycle, janela, single instance, wiring)
│       │   ├── backend-manager.ts      (D3 — spawn/env/health/kill/restart + migrations D5)
│       │   ├── app-protocol.ts         (D2 — factory createAppProtocolHandler)
│       │   ├── settings-store.ts       (D7)
│       │   ├── status-screen.ts        (D4 — estado + render/loadURL)
│       │   └── status-screen/index.html
│       └── preload/
│           └── index.ts                (D7 — contextBridge window.desktop)
│       └── tests/                      (unit: backend-manager, app-protocol, settings-store, status-screen)
Modificados:
├── package.json                         (scripts desktop:*)
├── pnpm-workspace.yaml                  (sem mudança — apps/* já cobre)
└── CLAUDE.md                            (estrutura + comandos do desktop)
```

---

## 4. Fluxo de Boot (sequência)

```text
app.whenReady
 ├─ requestSingleInstanceLock
 ├─ SettingsStore.load() → gera jwtSecret se ausente
 ├─ createAppProtocolHandler (só em prod)
 ├─ BackendManager.start()
 │   ├─ preflight: docker version? → prereq_failed se ausente
 │   ├─ MI_DESKTOP_MANAGED=1 → prisma migrate deploy → migration_failed se falhar
 │   ├─ spawn node dist/app.js
 │   └─ poll /api/health (500ms) → ready | backend_failed (timeout/exit)
 ├─ status-screen mostra estado até ready
 └─ ready → loadURL(frontend) + webRequest limpo
```

---

## 5. Decisões de Design

| ID | Decisão | Justificativa |
|----|---------|---------------|
| D1 | Shell-only, renderer = frontend existente | Fonte única da UI; menor superfície de manutenção |
| D2 | `protocol.handle` + `net.fetch` para proxy | Streaming nativo (SSE); sem corner cases de redirect; handler testável |
| D3 | Backend como child process com env controlado | Reusa stack; `OTEL_SDK_DISABLED` evita exporter gRPC falho; kill garantido no quit |
| D3a | Pré-requisitos (Docker/DB/Redis) verificados mas não provisionados | Mesmo comportamento da stack web; escopo MVP |
| D4 | Status screen em HTML estático do main | Funciona antes do backend; sem depender de React/build |
| D5 | Migrations via `prisma migrate deploy` executadas pelo main com flag `MI_DESKTOP_MANAGED` | Não acopla o backend ao desktop |
| D6 | Backend/frontend em `extraResources` (fora do asar) | Módulos nativos (sharp, engines Prisma) funcionam sem asarUnpack |
| D7 | `settings.json` + contextBridge | Config persistida; renderer sem acesso a Node |
| D8 | Single-instance + sandbox + openExternal | Segurança e ciclo de vida do Electron |

---

## 6. Riscos

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| Engines do Prisma 7 ou prebuilds do sharp ausentes no bundle | Backend não inicia no instalado | `prepare-backend.mjs` verifica artefatos e falha o build; smoke run do bundle |
| SSE bufferizado no proxy (`net.fetch`) | Progresso de conversão congela | Teste manual no dev com `desktop:dev` + swagger/console; handler retorna `Response` com `ReadableStream` |
| Porta 3333 ocupada | Backend não sobe | `settings.backendPort` editável + diagnóstico na tela de status |
| Docker/Postgres/Redis ausentes no host | Backend não sobe | Preflight + tela de status com orientação (`pnpm docker:up`, instalar Docker Desktop) |
| OTel exporter gRPC no desktop | Backend lento/barulhento | `OTEL_SDK_DISABLED=true` default no desktop |
| Vite dev server não iniciado no `desktop:dev` | Janela em branco no dev | Script `desktop:dev` usa `concurrently` com frontend+desktop (padrão do `dev:full`) |
| Caminhos com espaços no `userData`/instalação | Spawn quebra | Uso de `spawn(node, [script])` sem shell; paths via `path.join` |
| `pnpm deploy` não inclui `prisma` CLI | Migrations falham | Verificação no prepare script; fallback para `node node_modules/prisma/build/index.js` |

---

## 7. Testes

### Unitários (vitest em `apps/desktop/src/tests/`)

- `backend-manager.test.ts` — spawn com env correto, poll de health (mock fetch), timeout → `backend_failed`, kill SIGTERM/SIGKILL, restart
- `app-protocol.test.ts` — roteamento `/api`/`/auth`/`/users` → backend, estáticos servidos do resources, path traversal rejeitada
- `settings-store.test.ts` — criação, persistência, jwtSecret gerado uma única vez, escrita atômica
- `status-screen.test.ts` — transição de estados → loadURL chamado só em `ready`

### E2E (smoke, Playwright Electron — `playwright` já é dep do frontend)

- Lança o app dev → janela abre → `GET /api/health` via proxy retorna ok → login renderiza
- (Manual) Instalar o NSIS gerado e repetir o smoke no instalado

### Critérios de execução

```bash
pnpm --filter @mangaink/desktop test   # unit
pnpm lint                              # monorepo
pnpm --filter @mangaink/frontend build # pré-requisito do bundle
pnpm desktop:dist                      # gera instalador (validação manual)
```
