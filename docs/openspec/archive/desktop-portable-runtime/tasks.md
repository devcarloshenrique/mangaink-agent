# Tasks — Desktop Portable Runtime

## 1. Contratos de infraestrutura (backend)

- [x] 1.1 Criar `apps/backend/src/shared/infra/` com interfaces `IQueueService`, `IPubSub`, `IJournalStore`, `IStatusStore`, `ILockService` (tipos e assinaturas derivados dos serviços atuais e dos mocks de teste)
- [x] 1.2 Adicionar `p-queue` como dependência do backend (`pnpm --filter @mangaink/backend add p-queue`)
- [x] 1.3 Adicionar `MI_EMBEDDED_MODE` e `MI_EMBEDDED_RUNTIME_PATH` ao schema Zod de `shared/config/env.ts`; tornar `REDIS_URL` **opcional** quando `MI_EMBEDDED_MODE=1` (via `z.refine` ou `.optional()` com guard — o default `redis://localhost:6379` causa tentativa de conexão em modo embedded)
- [x] 1.4 Criar factory `createRuntimeAdapters(env)` em `shared/infra/` que devolve adaptadores Redis (default) ou in-memory (`MI_EMBEDDED_MODE=1`)

## 2. Adaptadores in-memory (backend)

- [x] 2.1 Implementar `InMemoryQueueService` (FIFO + **concurrency configurável por fila** — `inspect-source`/`download-only`: 3, `conversion-job`: 1 — + attempts/backoff exponencial 2s + `getJob`/`removeJob` + retenção N completos/falhos; `lockDuration`/`maxStalledCount` como no-op) com testes unitários (retry, backoff, concurrency, cancelamento)
- [x] 2.2 Implementar `InMemoryPubSub` (EventEmitter por canal, subscribe/unsubscribe) com testes
- [x] 2.3 Implementar `InMemoryJournalStore` (append/range/nextId monotônico/expire com TTL sweeper) com testes
- [x] 2.4 Implementar `InMemoryStatusStore` (**get retorna object/null, set faz merge parcial de campos** — reproduzindo semântica HSET/HGETALL do Redis Hash usado por `JobLiveStatusStore` e `ChapterDownloadStatusStore` — + clear + TTL expirado) com testes
- [x] 2.5 Implementar `InMemoryLockService` (acquire(key) → boolean, release(key), isLocked(key) → boolean — **sem token exposto ao chamador**, workerId interno + TTL — refletindo API real do `RedisLockService`) com testes
- [x] 2.6 Teste de unidade: nenhuma conexão Redis é criada quando `MI_EMBEDDED_MODE=1` (fábrica e composition root)

## 3. Migração dos serviços para os contratos (backend)

- [x] 3.1 Refatorar `bullmq.ts`/`createQueue` e os queue services (`inspect-queue`, `chapter-download-queue`, `conversion-queue`, `download-only-queue`, `mobi-preview-queue`) para consumir `IQueueService` injetado
- [x] 3.2 Refatorar `redis-pubsub.service`, `chapter-download-pubsub.service` e `conversion-pubsub.service` para `IPubSub` + `IJournalStore` injetados — **decompor os serviços**: hoje `ConversionPubSubService` e `ChapterDownloadPubSubService` acumulam operações de pub/sub E journal (`pubRpush`, `pubLrange`, `pubIncr`, `pubExpire`); os call-sites de journal passam a consumir `IJournalStore` separadamente
- [x] 3.2.1 Adaptar `ConversionEventsService` para consumir `IPubSub` + `IJournalStore` (hoje depende diretamente de `ConversionPubSubService`)
- [x] 3.3 Refatorar `redis-lock.service` para `ILockService` injetado (manter API: `acquire(sourceId) → boolean`, `release(sourceId)`, `isLocked(sourceId) → boolean` — sem mudança nos call-sites)
- [x] 3.4 Refatorar status stores (`job-live-status-store`, `mobi-preview-status-store`, `chapter-download-status-store`) para `IStatusStore` injetado (merge parcial preservado)
- [x] 3.5 **[PRIORIDADE — Bloqueia 3.6 e 2.6]** Transformar workers module-level (`inspectSourceWorker`, `conversionJobWorker`, `downloadOnlyWorker`) em factories iniciadas em `shared/server.ts` (padrão `startChapterDownloadWorker`/`startMobiPreviewWorker`). **Remover imports side-effect** de `server.ts` (`import '../modules/.../inspect-source.worker'`, `import '../modules/.../conversion-job.worker'`, `import '../modules/.../download-only.worker'`) — esses criam `new Worker(...)` com conexão Redis no load do módulo, causando crash em modo embedded. **Migrar instanciações de serviço** do module scope dos workers para dentro da factory (ex: `new RedisLockService()` e `new RedisPubSubService()` no `inspect-source.worker.ts`)
- [x] 3.6 Compor os adaptadores no `shared/server.ts` (composition root) e passar aos services/workers; adicionar guard para que `getRedis()` singleton (usado por `JobLiveStatusStore`) nunca seja importado/chamado em modo embedded
- [x] 3.7 Garantir que os testes existentes (unit + e2e com mocks) continuam verdes e adicionar suíte de integração do modo embedded (inspeção + conversão + preview sem Redis)

## 4. Runners KCC/MOBI embedded (backend)

- [x] 4.1 Extrair interface `IKccRunner` de `kcc-runner.service.ts` (**interface a criar — não existe ainda**) e implementar `KccRunnerEmbedded` (spawn `python.exe` + paths do host, parse de progresso `(\d+)%`, eventos equivalentes; instanciada **dentro do handler** do worker por job, não no module scope) com testes
- [x] 4.2 Implementar `MobiUnpackRunnerEmbedded` (**reusar interface `MobiUnpackRunner` que já existe** em `mobi-unpack-runner.service.ts`) (spawn `python.exe extract_mobi.py`, poll 250ms + `onTick`) com testes
- [x] 4.3 Fábrica de runners por `MI_EMBEDDED_MODE` (docker default) + resolução de paths via `MI_EMBEDDED_RUNTIME_PATH` + `PATH` do child com dir do `kindlegen.exe`
- [x] 4.4 Prova de conceito: `kcc-c2e --help` e conversão real de fixture via Python embutido (valida forma de invocação do entry point — ver Open Question no design)
- [x] 5.1 Criar `apps/desktop/scripts/runtime-manifest.json` com URLs, versões e SHA256 (Postgres EDB zip, python-build-standalone 3.11, wheels, KCC v10.3.0 source, kindlegen.exe build 1028, extract_mobi.py) + seção de licenças
- [x] 5.2 Criar `apps/desktop/scripts/prepare-runtime.mjs`: download + validação SHA256 + extração → `apps/desktop/resources/runtime/{postgres,python,kcc,kindlegen/}` (aborta em hash divergente; idempotente)
- [x] 5.3 Instalar wheels no site-packages do runtime + aplicar `patch_mobi_cover.py` no source do KCC
- [x] 5.4 Adicionar script `desktop:prepare:runtime` no `package.json` do desktop e do monorepo
- [x] 5.5 Validar manualmente: `python.exe -c "import PIL, psutil, requests, mobi"` e `kcc-c2e --help` do runtime preparado

## 6. Orquestração do desktop (main)

- [x] 6.1 Criar `apps/desktop/src/main/postgres-manager.ts` (initdb condicional, pg_ctl start/stop com porta livre, createdb garantido, diagnóstico) com testes unitários
- [x] 6.2 Atualizar `backend-manager.ts`: boot sequence embedded (PG → migrations → backend → health), estados `postgres_failed`, remoção do preflight Docker no modo embedded, shutdown ordenado (backend → python → PG) — com testes
- [x] 6.2.1 Migrar spawn do backend/migrations para usar `process.execPath` + `ELECTRON_RUN_AS_NODE=1` em produção (**ATENÇÃO (F6)**: fazer e testar esta mudança isoladamente antes de misturar com a refatoração do boot sequence para evitar mascarar bugs)
- [x] 6.3 Atualizar `settings-store.ts` (portas gerenciadas; `databaseUrl`/`redisUrl` ignoradas em modo embedded; persistência do estado gerenciado) com testes
- [x] 6.4 Atualizar `status-screen.ts` (novos estados/mensagens PT-BR + retry) e seus testes
- [x] 6.5 Atualizar `index.ts` do main (montagem do PostgresManager + env embedded no spawn) e o `desktop:dev` (host infra por default, embedded via flag após prepare)

## 7. Empacotamento e distribuição

- [x] 7.1 Adicionar `resources/runtime` ao `extraResources` do `electron-builder.yml`
- [x] 7.2 Integrar `desktop:prepare:runtime` à cadeia `desktop:dist` (exigir ou acionar; falhar com instrução clara)
- [x] 7.3 Verificar que `after-pack.mjs`/`prepare-backend.mjs` seguem funcionando com `resources/runtime/` presente
- [x] 7.4 Atualizar smoke E2E Playwright para cobrir modo embedded (`MI_EMBEDDED_MODE=1`, boot → login → inspect → conversão sem Docker) e o cenário de quit sem órfãos
- [x] 7.5 Validar instalador NSIS + portable em máquina limpa (offline): boot, conversão MOBI e preview de páginas no navegador

## 8. Docs e convenções

- [x] 8.1 Atualizar `CLAUDE.md` (pré-requisitos: Docker não é mais necessário no desktop; novos comandos `desktop:prepare:runtime`; novas env `MI_EMBEDDED_MODE`/`MI_EMBEDDED_RUNTIME_PATH`; arquitetura `shared/infra`)
- [x] 8.2 Atualizar `docs/source_inspect_spec.md`/`docs/fluxo-conversao-*.md` se citam Docker como requisito do desktop (arquivos não existem mais no repo — nada a corrigir; verificado via git ls-tree)
