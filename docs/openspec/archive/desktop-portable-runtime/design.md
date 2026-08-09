# Desktop Portable Runtime — Design de Arquitetura

> **Status:** DRAFT
> **Data:** 2026-08-06
> **Módulos:** `apps/desktop`, `apps/backend`, scripts do monorepo

---

## Context

O app desktop (change `desktop-electron-app`, entregue) embute apenas o código (frontend + backend), mas depende de infraestrutura do host: Docker (PostgreSQL, Redis, imagens KCC/mobi-unpack), Node no PATH (para `spawn('node', dist/app.js)` e `prisma migrate deploy`) e Python (imagens derivam de `python:3.11`). Para o público consumidor isso ainda é uma barreira: o app falha com `prereq_failed` sem Docker.

Estado atual relevante:

- Backend Fastify + Prisma 7 (`@prisma/adapter-pg`, `PrismaPg` em `shared/database/prisma.ts`) — schema 100% Postgres (UUID `gen_random_uuid()`, `JsonB`, `Timestamptz`).
- Redis usado em 5 superfícies: BullMQ (5 filas: `inspect-source`, `chapter-download`, `conversion-job`, `download-only`, `mobi-preview`), pub/sub para SSE (3 serviços), journal Redis List + `INCR` (replay SSE), status stores Hash/TTL (`job-live-status-store`, `mobi-preview-status-store`, `chapter-download-status-store`), locks `SET NX EX` (`redis-lock.service`).
- KCC roda via `docker run mangaink-kcc:10.3.0` (`kcc-runner.service.ts`, bind mounts `/input` + `/output`); extração MOBI via `docker run mangaink-unpack:0.4.1` (`mobi-unpack-runner.service.ts`, poll de `images/` a cada 250ms). KCC usa `kindlegen` (Linux i386, já vendored em `docker/kindlegen/kindlegen`) para saída MOBI.
- `BackendManager` (`apps/desktop/src/main/backend-manager.ts`): preflight `docker version` → migrations (`node prisma/.../migrate deploy`) → spawn `node dist/app.js` → health poll. Estados: `idle | starting | prereq_failed | migration_failed | backend_failed | ready`.
- Testes do backend já isolam filas via `createQueue: vi.fn(...)` — o contrato de fila é testável.

## Goals / Non-Goals

**Goals:**

- App desktop instalado funciona em máquina Windows limpa (sem Docker, Node, Python, Redis ou Postgres no host).
- Backend web/dev (docker-compose + Redis real) permanece funcional e inalterado em comportamento.
- Schema Prisma, migrations e adapters de banco inalterados.
- Provenance verificável (SHA256) de todos os binários vendored.
- Redundância zero no desktop: processos iniciados pelo app morrem com o app.

**Non-Goals:**

- Portabilidade macOS/Linux (continua Windows-only v1).
- Persistência de filas entre reinícios no desktop (jobs em voo se perdem em crash — aceito para single-user).
- Multi-instância/HA no desktop.
- Remoção do Docker da stack web (continua sendo o fluxo de dev/self-hosted).
- Auto-update, assinatura de código, Send-to-Kindle.

---

## Decisions

### D1 — PostgreSQL embutido: binário portable EDB (zip de binaries), não PGlite/SQLite

Vendora `postgresql-{versão}-{build}-windows-x64-binaries.zip` (download.postgresql.org, checksum fixado) em `apps/desktop/resources/runtime/postgres/`. O main executa:

```
1ª execução:  <runtime>/postgres/bin/initdb -D {userData}/pgdata -U postgres --auth=trust -E UTF8
start:        pg_ctl -D {userData}/pgdata -o "-p {porta}" -w start
setup:        createdb -h 127.0.0.1 -p {porta} -U postgres mangaink_agent_db  (se não existir)
stop:         pg_ctl -D {userData}/pgdata -m fast -w stop
```

- Data dir persistido em `userData/pgdata` (sobrevive a reinícios/updates).
- Porta auto-atribuída (socket livre na faixa 5432+; o main garante unicidade) → `DATABASE_URL=postgresql://postgres@127.0.0.1:{porta}/mangaink_agent_db`.
- Versão: alinhada ao que o Prisma 7 suporta (PG 15/16/17 — decidir a fixa na implementação, preferindo a mesma major dos containers locais para paridade de dev).

**Alternativas descartadas:** PGlite (WASM) — `prisma migrate deploy` exige servidor TCP real; SQLite — exigiria reescrever schema/migrations (contra o histórico de migração total para Postgres).

### D2 — Redis: substituição in-process via DIP, não binário Redis Windows

Cria-se a camada `apps/backend/src/shared/infra/` com contratos (interface) e duas implementações:

| Contrato | API | Redis (atual) | In-memory (novo) |
|---|---|---|---|
| `IQueueService` | `add(name, data, opts)` · `getJob(id)` · `removeJob(id)` | BullMQ adapter | `p-queue` + retry/backoff próprio |
| `IPubSub` | `publish(channel, msg)` · `subscribe(channel, cb)` → `unsubscribe` · `subscribeMany`/`unsubscribeMany` (fan-in) | Redis pub/sub | `EventEmitter` |
| `IJournalStore` | `append(key, entry)` · `range(key, start, end)` · `nextId(key)` · `expire(key, sec)` | Redis List + INCR + EXPIRE | arrays em memória + TTL sweeper |
| `IStatusStore` | `get(key)` → object/null · `set(key, partial, ttl?)` (merge parcial) · `clear(key)` | Redis Hash (`HSET`/`HGETALL`) + EXPIRE | `Map<string, Map<field, value>>` + TTL sweeper |
| `ILockService` | `acquire(key)` → boolean · `release(key)` · `isLocked(key)` → boolean | `SET NX EX` + Lua release | `Map` + workerId + TTL |

> **Nota sobre decomposição (F1):** Hoje, `ConversionPubSubService` e `ChapterDownloadPubSubService` acumulam operações de pub/sub **e** de journal (métodos `pubRpush`, `pubLrange`, `pubIncr`, `pubExpire`). A refatoração decompõe esses serviços em `IPubSub` + `IJournalStore` injetados separadamente — os call-sites de journal passam a consumir `IJournalStore`, não o pub/sub.

> **Nota sobre status stores (F3):** `JobLiveStatusStore` usa `HSET` com merge parcial (`set(jobId, { status, currentStep })` → merge nos campos do hash) e `HGETALL` para leitura. `ChapterDownloadStatusStore` usa `HMSET` com `{ jobId, status }`. O contrato `IStatusStore` modela essa semântica de hash com merge — não um simples key-value escalar.

> **Nota sobre lock (F2):** `RedisLockService` usa `workerId` interno (gerado no constructor) e não expõe token ao chamador. A API real é `acquire(sourceId) → boolean`, `release(sourceId)`, `isLocked(sourceId) → boolean`. O contrato preserva essa API para evitar refatoração nos call-sites (ex: `lockService.release(sourceId)` no inspect worker).

- **Seleção:** env `MI_EMBEDDED_MODE=1` → fábrica in-memory; ausente → comportamento atual (Redis). Composition root: `shared/server.ts` (onde já sobem os workers) e factories dos módulos.
- **Semântica da fila in-memory:** fila FIFO por queue-name, concurrency **configurável por fila** (refletindo os valores reais: `inspect-source` e `download-only` usam concurrency 3, `conversion-job` usa concurrency 1), `attempts`/`backoff` exponencial replicados via timer, `removeOnComplete/removeOnFail` com retenção dos últimos N, `getJob`/`remove` suportados (usados no cancelamento via `conversion-queue.service`/`download-only-queue.service`). `lockDuration`/`maxStalledCount` do BullMQ não se aplicam em single-process — documentados como no-op.
- **Worker:** `new Worker(...)` module-level vira factory `startQueueWorker(name, processor, opts)` — padrão já existente (`startChapterDownloadWorker`, `startMobiPreviewWorker` em `server.ts`). `inspectSourceWorker`, `conversionJobWorker` e `downloadOnlyWorker` (hoje module-level) passam para factories. **Atenção (F4):** os imports side-effect em `server.ts` (`import '../modules/.../inspect-source.worker'`, `import '../modules/.../conversion-job.worker'`, `import '../modules/.../download-only.worker'`) executam `new Worker(...)` com `connection: { url: env.REDIS_URL }` no load do módulo — em modo embedded isso cria conexões Redis antes da composition root ser montada. Esses imports **devem ser removidos** e os workers iniciados via factory condicional dentro de `createServer()`. Todas as instanciações de serviço no module scope dos workers (ex: `new RedisLockService()`, `new RedisPubSubService()` em `inspect-source.worker.ts`) também devem migrar para dentro da factory.

**Alternativas descartadas:** binário Redis Windows (tporadowski é 5.0.14.1 — BullMQ v5 exige ≥6.2; Memurai proprietário), `ioredis-mock` (BullMQ não suporta oficialmente).

### D3 — Runners KCC/MOBI: impl `docker` (web) e `embedded` (desktop)

`KccRunnerService` e `MobiUnpackRunnerService` passam a ser factories atrás de uma interface (`IKccRunner` a criar, `MobiUnpackRunner` **já existe** em `mobi-unpack-runner.service.ts`). Em `MI_EMBEDDED_MODE`:

- **KCC:** spawn `python.exe <kcc-dir>/kcc-c2e.py <flags>` (paths do host, sem bind mounts). O CLI do KCC é o entry point `kcc-c2e` do setup.py — no modo fonte, invoca-se o script do pacote com `PYTHONPATH` apontando para o source dir; o parser de progresso `(\d+)%` no stdout é reaproveitado.
- **MOBI:** spawn `python.exe extract_mobi.py <mobiPath> <outputDir>` com o mesmo poll de `images/` a cada 250ms do runner atual.
- Kindlegen: dir com `kindlegen.exe` incluído no `PATH` do child (KCC auto-detecta) + flag explícita se suportada na versão 10.3.0.
- `checkDockerAvailable()` vira no-op em modo embedded (hoje é chamado dentro de `KccRunnerService.run()`, não no load do módulo — sem risco de side-effect).
- **Nota:** No `conversion-job.worker.ts`, `KccRunnerService` e `JobLiveStatusStore` são instanciados **dentro do handler** do worker (por job), não no module scope. A factory do runner embedded deve ser resolvida dentro do handler via a mesma composition root.

### D4 — Python embutido: python-build-standalone 3.11, não PyInstaller

`apps/desktop/resources/runtime/python/` contém o runtime "full" (não o embeddable mínimo) do python-build-standalone 3.11 (mesma major da imagem Docker atual) + `site-packages` preparados por `desktop:prepare:runtime` via extração de wheels (Pillow, requests, psutil, six, `mobi==0.4.1`) e cópia do source do KCC v10.3.0 (tag GitHub) + `patch_mobi_cover.py` aplicado (mesmo pipeline do Dockerfile) + `docker/extract_mobi.py`.

**Alternativa descartada:** exes PyInstaller compilados em CI — artefatos maiores (~80–120MB), dependência de pipeline externo e divergência do código já validado em Docker.

### D5 — Spawn do backend e migrations sem Node no host

Em produção, `BackendManager` usa `process.execPath` com `ELECTRON_RUN_AS_NODE=1` (Node do próprio Electron) em vez de `spawn('node', ...)`:

```
spawn(process.execPath, [appPath], { env: { ...env, ELECTRON_RUN_AS_NODE: '1' } })
spawn(process.execPath, [prismaCli, 'migrate', 'deploy'], { env: { ..., ELECTRON_RUN_AS_NODE: '1' } })
```

Dev (`desktop:dev`, não packaged) mantém `node` do host. Teste do e2e smoke passa a validar o caminho packaged.

### D6 — Orquestração: boot sequence e novos estados

`BackendManager.start()` (modo embedded):

```
1. resolve porta PG livre e porta do backend livre
2. initdb se pgdata ausente → pg_ctl start → createdb se ausente
3. prisma migrate deploy (via Electron Node)
4. spawn backend (via Electron Node) com env:
   DATABASE_URL=<pg local>, MI_EMBEDDED_MODE=1, MI_DESKTOP_MANAGED=1,
   STORAGE_PATH={userData}/storage, PORT=<porta>, JWT_SECRET=<settings>
   (REDIS_URL omitido/ignorado — sem Redis)
5. health poll em /api/health → ready
```

Estados: `idle | starting | postgres_failed | migration_failed | backend_failed | ready`. `prereq_failed` (docker check) sai do fluxo embedded. Shutdown: `backend.stop()` (SIGTERM→SIGKILL) → `pg_ctl stop -m fast` → resolução.

Settings: no modo embedded, `databaseUrl`/`redisUrl` do `settings.json` deixam de ser usados (portas gerenciadas); `backendPort` e `jwtSecret` continuam. O store mantém campos para compatibilidade (web dev) e dev pode forçar `MI_EMBEDDED_MODE=0`.

### D7 — Dev mode

`desktop:dev` continua com infra do host (Docker) por padrão (`MI_EMBEDDED_MODE` ausente). Modo embedded em dev exige `pnpm desktop:prepare:runtime` e `MI_EMBEDDED_MODE=1` — é o caminho usado no smoke E2E para cobrir o cenário portable sem Docker.

### D8 — Empacotamento e provenance

- `apps/desktop/scripts/prepare-runtime.mjs`: baixa, valida SHA256 (lista fixa em `runtime-manifest.json` com URLs + hashes), extrai e monta `apps/desktop/resources/runtime/`. Fracassa se hash divergir (sem surpresa no install).
- `electron-builder.yml`: `extraResources` ganha `runtime/` → `resources/runtime`.
- `pnpm desktop:dist` e `desktop:prepare:backend` passam a exigir runtime preparado (ou chamar `desktop:prepare:runtime` na cadeia).

---

## Risks / Trade-offs

- [Paridade semântica da fila in-memory vs BullMQ (retry/backoff/removal/delays)] → contratos + testes unitários dedicados do adapter (retry, backoff, concurrency, getJob/remove); e2e do fluxo de conversão roda em modo embedded.
- [Perda de jobs em voo em crash do app (sem persistência)] → aceito (single-user); jobs são re-enfileiráveis pelo usuário; documentado.
- [TTL in-memory não é durável e pode divergir entre processos] → desktop é single-process; web continua com Redis.
- [Binários vendored: fonte/versão mudam ou quebram] → manifest com hashes fixos; alinhar versões às imagens Docker atuais (PG major = containers, Python 3.11, KCC v10.3.0, kindlegen build 1028).
- [kindlegen.exe: EULA Amazon / redistribuição] → já é o caso hoje com o binário Linux vendored; manter registro de licença em `runtime-manifest.json`/README do runtime.
- [KCC GPLv3 empacotado] → mesma situação do Dockerfile atual; distribuir fonte junto (o source do KCC já é vendored no runtime).
- [Instalador ~100–120MB maior] → aceito para publico consumidor; portable `-p` mantém tamanho único (NSIS comprime bem).
- [`ELECTRON_RUN_AS_NODE` com paths espaçados (`userData` com espaço)] → usar spawn com args (sem shell) e paths absolutos corretamente citados; coberto nos testes do BackendManager.
- [Imports side-effect que criam conexões Redis no boot (F4)] → `server.ts` importa workers como side-effect (`import '../modules/.../inspect-source.worker'`), o que cria `new Worker(...)` com `connection.url` no load. Em modo embedded, isso tenta conectar a Redis inexistente. Mitigação: converter todos os workers para factories chamadas condicionalmente dentro de `createServer()`.
- [REDIS_URL no schema Zod em modo embedded (F5)] → o default `redis://localhost:6379` causa tentativa de conexão mesmo quando Redis não existe. Mitigação: tornar REDIS_URL opcional quando `MI_EMBEDDED_MODE=1`; usar `z.refine` ou `.optional()` com guard no schema.
- [Migração entre majors do data dir PG em futuras versões] → data dir versionado em `userData/pgdata`; upgrade exigirá dump/restore — fora de escopo, documentar.

## Migration Plan

1. Backend primeiro (D2/D3/D4): tudo atrás de `MI_EMBEDDED_MODE` — default off; web intacta; testes novos + existentes verdes.
2. Desktop (D1/D5/D6/D8): prepare-runtime → BackendManager embedded → status screen → empacotamento.
3. Rollback: remover env flag do settings; comportamento volta ao fluxo Docker (web/dev). Sem migração de dados (schema intocado).

## Open Questions

- Versão major exata do PostgreSQL embutido (15 vs 16 vs 17) — decidir na implementação com base nos containers locais.
- `p-queue` vs implementação própria de fila (concorrência + delay) — `p-queue` recomendado; validar suporte a prioridade/delay (delay pode ser implementado com timers).
- Formato exato de invocação do KCC em modo fonte (script `kcc-c2e.py` via PYTHONPATH vs `-m kindlecomicconverter`) — resolver com prova de conceito na task de vendoring.
- Se `desktop:dist` deve baixar o runtime automaticamente (rede) ou exigir prepare explícito — padrão atual (prepare explícito) recomendado.
- Adapter `ConversionEventsService` — consome `ConversionPubSubService` diretamente; após decomposição em `IPubSub` + `IJournalStore`, avaliar se vira wrapper de ambos ou se é refatorado para usar contratos separados.
