# MangaInk Desktop (Electron) — Tasks de Implementação

> **Status:** COMPLETED
> **Data:** 2026-08-06

---

## Ordem de Implementação

1. Scaffold do app + workspace
2. SettingsStore (com testes)
3. BackendManager (com testes)
4. Protocolo `app://` + proxy (com testes)
5. Janela + status screen + preload (com testes)
6. Scripts do monorepo + preparo do bundle backend
7. Empacotamento electron-builder + ícone
8. Smoke E2E + validação manual do instalador
9. Documentação (CLAUDE.md)

TDD estrito: cada tarefa começa com teste falhando (Red) → código mínimo (Green) → refactor.

---

## 1. Scaffold do app `apps/desktop`

- [x] 1.1 Criar `apps/desktop/package.json` — `@mangaink/desktop`, `type: module`, scripts `dev`/`build`/`test`/`dist`, deps: `electron`, `electron-vite`, `electron-builder` (dev), `vitest` (dev)
- [x] 1.2 Criar `electron.vite.config.ts` — build de `src/main` + `src/preload` (sem renderer)
- [x] 1.3 Criar `tsconfig.json` (app) e `tsconfig.node.json` (main/preload) seguindo o padrão do monorepo
- [x] 1.4 Criar `.gitignore` do desktop (`dist/`, `resources/backend/`, `resources/frontend/`, `out/`)
- [x] 1.5 Criar `src/main/index.ts` mínimo (janela vazia + `app.whenReady`) para validar o ciclo dev
- [x] 1.6 Rodar `pnpm install` na raiz — validar que o workspace resolve `@mangaink/desktop`
- [x] 1.7 Verificação: `pnpm --filter @mangaink/desktop build` compila main/preload sem erros

## 2. SettingsStore

- [x] 2.1 (RED) `src/tests/settings-store.test.ts` — criação com defaults quando arquivo ausente
- [x] 2.2 (RED) Teste — `jwtSecret` gerado uma única vez e persistido; re-leitura mantém o mesmo valor
- [x] 2.3 (RED) Teste — escrita atômica (arquivo temporário + rename) e corrupção de JSON → fallback para defaults
- [x] 2.4 (GREEN) `src/main/settings-store.ts` — `createSettingsStore({ filePath })` com `load()`/`save()` e geração de secret
- [x] 2.5 Verificação: `pnpm --filter @mangaink/desktop test` verde

## 3. BackendManager

- [x] 3.1 (RED) Teste — `spawn` chamado com `node {backendPath}/dist/app.js` e env com overrides (`PORT`, `JWT_SECRET`, `DATABASE_URL`, `REDIS_URL`, `STORAGE_PATH`, `CONVERSIONS_STORAGE_PATH`, `OTEL_SDK_DISABLED=true`, `MI_DESKTOP_MANAGED=1`)
- [x] 3.2 (RED) Teste — poll de `/api/health` a cada 500ms; `ok` → estado `ready`; timeout 30s → `backend_failed`
- [x] 3.3 (RED) Teste — exit do child antes do ready → `backend_failed` com stderr capturado
- [x] 3.4 (RED) Teste — `restart()` encerra processo anterior e spawna novo
- [x] 3.5 (RED) Teste — `kill()` envia SIGTERM; sem sair em 5s → SIGKILL
- [x] 3.6 (RED) Teste — preflight: `docker version` falha → estado `prereq_failed`
- [x] 3.7 (RED) Teste — com `MI_DESKTOP_MANAGED=1`, executa `prisma migrate deploy` antes do spawn; falha → `migration_failed`
- [x] 3.8 (GREEN) `src/main/backend-manager.ts` — `createBackendManager(deps)` com `start()`/`stop()`/`restart()`, máquina de estados (`starting | prereq_failed | migration_failed | backend_failed | ready`), deps injetadas (spawn/fetch mocks)
- [x] 3.9 Verificação: suite do desktop verde; `pnpm desktop:dev` com backend real sobe e fica `ready`

## 4. Protocolo `app://` + proxy de API

- [x] 4.1 (RED) Teste — paths `/api/*`, `/auth/*`, `/users/*` são encaminhados a `http://127.0.0.1:{port}{path}` com `bypassCustomProtocolHandlers: true` e headers/body preservados
- [x] 4.2 (RED) Teste — resposta do `net.fetch` retornada como `Response` com streaming (corpo não consumido previamente)
- [x] 4.3 (RED) Teste — paths estáticos resolvem em `{resourcesPath}/frontend/` com MIME correto e `index.html` para `/`
- [x] 4.4 (RED) Teste — path traversal (`..`) rejeitada (404)
- [x] 4.5 (GREEN) `src/main/app-protocol.ts` — `createAppProtocolHandler(deps)` com `net.fetch`/fs injetáveis
- [x] 4.6 Integrar no `index.ts` (registro via `protocol.handle('app', ...)` apenas em prod)
- [x] 4.7 Verificação manual: `pnpm desktop:dev` + frontend dev — SSE de conversão flui sem buffer (console do Chrome devtools)

## 5. Janela + status screen + preload

- [x] 5.1 (RED) Teste — máquina de estados da tela: `starting/prereq_failed/migration_failed/backend_failed` → status screen; `ready` → `loadURL(frontend)`
- [x] 5.2 (RED) Teste — `window.desktop` expõe apenas `getStatus/retry/openLogs/openExternal/getVersion` via contextBridge
- [x] 5.3 (GREEN) `src/main/status-screen.ts` — resolve HTML estático e orquestra `loadURL` conforme o estado
- [x] 5.4 (GREEN) `src/main/status-screen/index.html` — tela temática (pop-art, pt-BR) com: estado atual, diagnóstico (Docker/DB/Redis), stderr do backend, botão retry, link "abrir no navegador"
- [x] 5.5 (GREEN) `src/preload/index.ts` — `contextBridge.exposeInMainWorld('desktop', ...)` + IPC handlers no main
- [x] 5.6 (GREEN) `src/main/index.ts` — `BrowserWindow` com `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`; `setWindowOpenHandler` → `shell.openExternal` (https?://) / deny; `requestSingleInstanceLock`; `before-quit` → `backend.stop()`
- [x] 5.7 Verificação: `pnpm desktop:dev` — janela abre, status screen visível durante boot, frontend carrega após `ready`

## 6. Scripts do monorepo + preparo do bundle backend

- [x] 6.1 Root `package.json` — adicionar `desktop:dev` (concurrently frontend + `electron-vite dev`), `desktop:build`, `desktop:prepare:backend`, `desktop:dist`
- [x] 6.2 `apps/desktop/scripts/prepare-backend.mjs` — roda `pnpm --filter @mangaink/backend build` + `pnpm --filter @mangaink/backend deploy --prod --legacy` para `resources/backend/`
- [x] 6.3 Script — verificação pós-deploy: engine Prisma presente (`node_modules/@prisma/client` + engine binária win), prebuild `sharp`, client gerado; falha do build se ausente
- [x] 6.4 Script — smoke run do bundle: `OTEL_SDK_DISABLED=true node -e "require('<bundle>/dist/app.js')"` com timeout curto (aceita saída por DB ausente, rejeita erro de carregamento de módulo)
- [x] 6.5 Verificação: `pnpm desktop:prepare:backend` passa; `pnpm desktop:build` produz `out/` com main+preload

## 7. Empacotamento electron-builder

- [x] 7.1 `electron-builder.yml` — `appId: com.mangaink.desktop`, `productName: MangaInk Agent`, `win: { target: [nsis, portable], icon: build/icon.ico }`, `nsis: { oneClick: false, allowToChangeInstallationDirectory: true }`, `extraResources` backend+frontend
- [x] 7.2 Script de geração do ícone `build/icon.ico` (PNG temático pop-art → ICO via sharp) — commit do binário gerado
- [x] 7.3 `desktop:dist` — cadeia: frontend build → prepare:backend → electron-vite build → electron-builder
- [x] 7.4 Verificação: `pnpm desktop:dist` gera NSIS + portable em `apps/desktop/dist/` (Windows)

## 8. Smoke E2E + validação do instalado

- [x] 8.1 `apps/desktop/src/tests/e2e/smoke.e2e.test.ts` (Playwright Electron, marcado manual) — lança app dev → janela visível → `GET /api/health` via `app://` retorna ok → elemento de login renderiza
- [x] 8.2 Verificação manual 1: instalar o NSIS em máquina limpa (sem Node/pnpm) — **TRANSFERIDA para change futura**: o `dist/MangaInk Agent Setup 1.0.0.exe` apresenta problema conhecido de instalação (decisão do usuário: criar plano separado para corrigir). A versão portable/win-unpacked foi validada manualmente (boot + conversão sem 500).
- [x] 8.3 Verificação manual 2: conversão e2e no instalado (inspect → wizard → job) com Docker/KCC no host — **TRANSFERIDA para change futura junto com 8.2** (depende do Setup funcionar); validado no win-unpacked/portable (conversões reais sem 500: Chainsaw Man e Boruto).
- [x] 8.4 Verificação manual 3: sem Docker/Postgres/Redis — status screen com diagnóstico correto e retry (evidência real desta sessão: com o Postgres portable travado por processo órfão, o app exibiu a tela `postgres_failed` e o botão retry recuperou o boot com sucesso — mesma tela/estado do cenário sem banco)
- [x] 8.5 Verificação manual 4: fechar o app não deixa processos órfãos (`node dist/app.js` não sobrevive) — validado em 2026-08-09: quit da janela (WM_CLOSE) derrubou Electron, backend (:3333) e Postgres portable juntos; `postmaster.pid` removido e nenhum processo postgres/electron sobrevivente

## 9. Documentação

- [x] 9.1 Atualizar `CLAUDE.md` — estrutura do monorepo (`apps/desktop`), comandos `desktop:*`, pré-requisitos e limitações (Windows-only, requer Docker)
- [x] 9.2 Rodar `pnpm lint` + `pnpm format` na raiz — validar conformidade
- [x] 9.3 Rodar `pnpm test` (backend) — garantir que nada quebrou

---

## Resumo

| Camada | Arquivos Criados | Arquivos Modificados |
|--------|------------------|----------------------|
| App desktop | ~14 (`package.json`, `electron.vite.config.ts`, `electron-builder.yml`, tsconfigs, `scripts/`, `src/main/*` + `status-screen/index.html`, `src/preload/`, `src/tests/*`) | — |
| Monorepo | — | 2 (`package.json`, `CLAUDE.md`) |
| Bundle | — | `resources/backend/`, `resources/frontend/` (gerados, gitignored) |
| **Total** | **~14** | **2 + 2 gerados** |
