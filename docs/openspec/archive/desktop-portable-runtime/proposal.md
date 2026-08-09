## Why

O MangaInk Desktop (primeiro lançamento) ainda exige do usuário final: Docker instalado, containers PostgreSQL/Redis no host, imagem `mangaink-kcc:10.3.0`, imagem `mangaink-unpack:0.4.1`, Python no PATH e até `node` no PATH para spawnar o backend (`spawn('node', ...)`). Para um público consumidor, isso não é um app desktop — é um ambiente self-hosted com uma janela em volta. Esta change torna o app **100% portable**: instalar e abrir é tudo; o runtime completo (banco, filas, conversor) vem embutido.

## What Changes

- **PostgreSQL embutido**: binário portable (zip de binários EDB) vendored em `apps/desktop/resources/runtime/`; o processo main executa `initdb` (1ª execução), sobe `pg_ctl` em porta auto-atribuída com data dir persistido em `userData/pgdata` e derruba no quit (`pg_ctl stop -m fast`). Schema, migrations e `@prisma/adapter-pg` permanecem intocados.
- **Redis substituído por runtime in-process no backend (DIP)**: novos contratos de domínio `IQueueService`, `IPubSub`, `IJournalStore`, `IStatusStore`, `ILockService` com duas implementações — adaptadores Redis (stack web, atual) e adaptadores in-memory (desktop, `p-queue` + `EventEmitter` + Map com TTL) — selecionados por env `MI_EMBEDDED_MODE=1`. BullMQ/ioredis deixam de ser pré-requisito no desktop. **Nota:** `ConversionPubSubService` e `ChapterDownloadPubSubService` que hoje acumulam operações de pub/sub e journal são decompostos em `IPubSub` + `IJournalStore`. Os imports side-effect de workers em `server.ts` que criam conexões Redis no boot são eliminados em favor de factories condicionais. `REDIS_URL` torna-se opcional no schema Zod quando `MI_EMBEDDED_MODE=1`.
- **KCC e extração MOBI sem Docker**: runtime Python embutido (python-build-standalone 3.11) + KCC v10.3.0 (source) + wheels + `kindlegen.exe` vendored, reusando `patch_mobi_cover.py` e `docker/extract_mobi.py`. Os runners ganham abstração com impl `docker` (web, atual) e `embedded` (spawn de `python.exe`).
- **Spawn do backend sem Node no host**: `BackendManager` passa a usar `ELECTRON_RUN_AS_NODE=1` com `process.execPath` (ou `utilityProcess.fork`) para backend e migrations — corrige gap latente do pacote instalado.
- **Orquestração do desktop**: boot sequence (Postgres → migrations → backend → health), novos estados de falha na status screen (Postgres/runtime), settings com portas gerenciadas, shutdown ordenado de todos os filhos.
- **Empacotamento**: `extraResources` ganha `runtime/`; novo script `desktop:prepare:runtime` (download + SHA256 + extract) integrado ao fluxo `desktop:dist`. Instalador cresce ~100–120MB.
- **BREAKING (desktop apenas)**: `DATABASE_URL`/`REDIS_URL` passam a ser gerenciados pelo app (portas auto-atribuídas) — o `settings.json` existente deixa de ser fonte de verdade no modo embutido; fluxo dev/web com Docker permanece inalterado.

## Capabilities

### New Capabilities

- `embedded-postgres`: vendoring do binário portable do PostgreSQL, lifecycle (initdb/pg_ctl start/stop), data dir persistido, porta auto-atribuída e URL derivada para o backend.
- `backend-inprocess-runtime`: contratos de infra no backend (fila, pub/sub, journal, status, locks) + adaptadores in-memory + fábrica por `MI_EMBEDDED_MODE` + runners KCC/MOBI com impl embedded.
- `embedded-python-kcc`: runtime Python embutido, vendoring de KCC/wheels/kindlegen.exe, resolução de paths e execução do KCC e do extract_mobi sem Docker.
- `desktop-runtime-orchestration`: boot sequence gerenciada pelo processo main, estados da status screen, settings gerenciados, shutdown ordenado e spawn via Node do Electron.
- `packaging-portable`: preparação do runtime (download/verificação), integração com electron-builder e `desktop:dist`.

### Modified Capabilities

<!-- Nenhuma spec existente (chapter-reader, conversion-field-rendering, exclusive-preset-lock, manga-detail, preset-field-sync, user-preset-crud) muda em nível de REQUIREMENTS. -->

## Impact

- **`apps/backend`**: novos módulos `shared/infra/` (contratos) e `shared/infra/inmemory/`; adaptação de `redis-pubsub.service`, `redis-lock.service`, `chapter-download-pubsub.service`, `chapter-download-status-store.service`, `conversion-pubsub.service`, status stores, `bullmq.ts`/`createQueue`, workers (virarem factories) e `kcc-runner.service`/`mobi-unpack-runner.service` (impl embedded). Env nova: `MI_EMBEDDED_MODE`, `MI_EMBEDDED_RUNTIME_PATH`.
- **`apps/desktop`**: `backend-manager.ts` (boot Postgres + spawn via Electron Node), `settings-store.ts` (portas gerenciadas), `status-screen` (novos estados), `electron-builder.yml` (`extraResources` runtime), novo `scripts/prepare-runtime.mjs`, testes atualizados.
- **Monorepo**: scripts `desktop:prepare:runtime`, `kcc:build`/`mobi:build` permanecem (web); `pnpm desktop:dist` passa a exigir runtime preparado.
- **Binários vendored (provenance fixa)**: `postgresql-*-windows-x64-binaries.zip` (EDB), `python-build-standalone` 3.11 embeddable, wheels (Pillow/requests/psutil/mobi/six), `kindlegen.exe` (build 1028, mesmo padrão do `docker/kindlegen/kindlegen`), KCC v10.3.0 source.
- **Deps**: `p-queue` (novo, backend); BullMQ/ioredis permanecem (web).
- **Licenciamento**: KCC (GPLv3), PostgreSQL (permissiva), Python (PSF), kindlegen (EULA Amazon — já vendored hoje).
