# MangaInk Desktop (Electron) — Proposta

> **Status:** DRAFT
> **Data:** 2026-08-06
> **Módulos:** `apps/desktop` (novo) + scripts do monorepo + empacotamento Windows

---

## 1. Problema

### 1.1. MangaInk Agent é uma aplicação web self-hosted

O usuário precisa executar manualmente quatro componentes para usar o produto: frontend Vite (5173), backend Fastify (3333), PostgreSQL e Redis (Docker) — além da imagem Docker do KCC para conversões. Para um público consumidor (leitor de mangás), isso é uma barreira de entrada alta.

### 1.2. Sem experiência desktop

Não existe forma de o usuário ter uma janela nativa do MangaInk: tudo roda no navegador com servidores iniciados via terminal.

---

## 2. Solução Proposta

Criar `apps/desktop`, um shell **Electron** que:

1. **Embedded backend** — o processo main spawna o backend Fastify já compilado (`node dist/app.js`) como processo filho, com env derivado de um arquivo de configuração persistido em `userData`.
2. **Janela nativa** — carrega o frontend existente (dev: Vite dev server; prod: `dist/` servido via protocolo customizado `app://`), sem duplicar o código React.
3. **Proxy de API no main** — requisições `/api/*`, `/auth/*`, `/users/*` feitas pelo renderer são encaminhadas ao backend local via `protocol.handle()` + `net.fetch`, preservando streaming (SSE e imagens). Nenhuma mudança em frontend/backend.
4. **Tela de status/pré-requisitos** — enquanto o backend sobe ou falha, o main mostra uma tela própria (HTML estático, sem React) indicando o estado: iniciando, Docker ausente, banco inacessível, falha — com botão de retry.
5. **Migrations no boot** — quando gerenciado pelo desktop (`MI_DESKTOP_MANAGED=1`), executa `prisma migrate deploy` do bundle antes de iniciar a API.
6. **Instalador Windows** — empacotamento com electron-builder (NSIS + portable), incluindo o bundle do backend (dist + node_modules de produção + engines do Prisma + prebuilds do sharp) e o `dist/` do frontend em `extraResources`.
7. **Segurança** — `contextIsolation: true`, `nodeIntegration: false`, single-instance lock, janelas externas abertas via `shell.openExternal`.

---

## 3. Fluxo

```text
Usuário instala MangaInk Desktop (NSIS)
│
├─ App inicia (single instance lock)
│
├─ Lê settings.json (userData): porta, DATABASE_URL, REDIS_URL, JWT_SECRET
│   └─ Primeira execução: gera JWT_SECRET e salva
│
├─ Spawna backend: node {resources}/backend/dist/app.js
│   ├─ Env: PORT, DATABASE_URL, REDIS_URL, STORAGE_PATH={userData}/storage,
│   │        CONVERSIONS_STORAGE_PATH, JWT_SECRET, OTEL_SDK_DISABLED=true,
│   │        MI_DESKTOP_MANAGED=1
│   └─ Boot: prisma migrate deploy → app.listen
│
├─ Poll GET /api/health até "ok" (timeout configurável)
│   ├─ Falha → tela de status com diagnóstico (Docker? DB? Redis?) + retry
│   └─ Ok → janela carrega o frontend
│
├─ Janela: frontend (dev: http://localhost:5173 | prod: app://)
│   └─ Requisições /api/*, /auth/*, /users/* → protocol.handle → net.fetch
│       → http://127.0.0.1:{PORT} (SSE streamado, sem buffer)
│
└─ Quit: encerra child (SIGTERM → SIGKILL após timeout) → fecha janela
```

---

## 4. Escopo

### Incluído

- [ ] Novo app `apps/desktop` (workspace `@mangaink/desktop`): main + preload, sem renderer React próprio
- [ ] `BackendManager`: spawn/env/health-check/retry/kill do backend compilado
- [ ] Protocolo `app://` com proxy de API (`/api`, `/auth`, `/users`) via `net.fetch` preservando SSE
- [ ] Tela de status/pré-requisitos (HTML estático do main) + IPC `window.desktop`
- [ ] `SettingsStore`: settings.json em `userData` (porta, DATABASE_URL, REDIS_URL, JWT_SECRET)
- [ ] Migrations automáticas no boot gerenciado (`prisma migrate deploy`)
- [ ] Scripts do monorepo: `desktop:dev`, `desktop:build`, `desktop:prepare:backend`, `desktop:dist`
- [ ] Preparo do bundle do backend (build + `pnpm deploy --prod` + verificação de engines Prisma 7 / sharp / client gerado)
- [ ] electron-builder: targets `nsis` + `portable`, `extraResources` com `backend/` e `frontend/`
- [ ] Ícone do app (`build/icon.ico` temático)
- [ ] Smoke E2E com Playwright Electron (janela abre + proxy funcional) e validação manual do instalador
- [ ] Atualização do `CLAUDE.md` (estrutura e comandos)

### Excluído

- [ ] Empacotamento para macOS/Linux (Windows-only no primeiro lançamento)
- [ ] Auto-update (electron-updater)
- [ ] Substituição do Docker (Postgres/Redis/KCC continuam pré-requisitos do host)
- [ ] SQLite ou filas in-process (fora de escopo — change futura)
- [ ] Reescrita do renderer em React dentro do desktop
- [ ] Menu nativo (AppMenu) customizado com ações do produto
- [ ] Integração com envio ao Kindle (Send-to-Kindle) nativa
- [ ] Tray/background: app não roda minimizado em bandeja

---

## 5. Critérios de Aceitação

1. `pnpm desktop:dev` abre uma janela Electron com o frontend dev e o backend funcional (login + wizard + biblioteca operacionais)
2. `pnpm desktop:dist` gera instalador NSIS + portable em `apps/desktop/dist/` (Windows)
3. O instalado funciona sem Node/pnpm no host: janela abre, backend sobe, login e listagem funcionam
4. Conversão e2e (inspect → wizard → job) funciona no app empacotado (requer Docker/KCC no host)
5. Primeira execução gera `settings.json` em `userData` com `JWT_SECRET` persistido
6. Backend morre junto com o app (sem processos órfãos)
7. Sem Docker/Postgres/Redis no host, a tela de status exibe diagnóstico claro e botão retry
8. `contextIsolation: true`, `nodeIntegration: false` e single-instance lock ativos
9. SSE (`/events`) funciona dentro do app (streaming não bufferizado)
10. Testes unitários do `BackendManager`, `SettingsStore` e handler do protocolo passam

---

## 6. Dependências

- `apps/frontend` — build `dist/` consumido pelo desktop (dev: Vite dev server + proxy)
- `apps/backend` — `dist/app.js` + `prisma migrate deploy` + deps de produção
- Docker no host — PostgreSQL, Redis e imagens `mangaink-kcc:10.3.0` / `mangaink-unpack:0.4.1` (pré-requisito existente)
- `@mangaink/shared` — via backend (sem mudanças)
- Novas deps: `electron`, `electron-vite`, `electron-builder`, `vitest` (testes do desktop)
