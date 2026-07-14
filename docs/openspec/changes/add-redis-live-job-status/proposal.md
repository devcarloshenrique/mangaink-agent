## Why

Mesmo após a change `migrate-conversions-and-jobs-to-postgres`, o "hot path" de atualização de status do Job ainda escreve no Postgres a cada fase (preparing → downloading → converting → packaging + progress por capítulo + completion/failure). Para uma conversão com 10 Jobs e 50 capítulos cada, isso gera ~500+ `UPDATE`s em Postgres — sem contar polling SSE via `syncStatus()` que regra agregados em cada GET. Migrar **status live** para Redis Hash (HSET/HGETALL) reduz o hot path a O(1) atímico em RAM, e `syncStatus()` lê N HGETALL em vez de N<A SELECT. Estado durável (snapshot final) permanece em Postgres — gravado uma única vez quando o Job atinge estado terminal.

## What Changes

- **ADDED** `apps/backend/src/shared/redis/job-status-store.ts` — helper `JobLiveStatusStore` com `set(jobId, partial)`, `get(jobId)`, `clear(jobId)`, `setTerminal(jobId, terminalFields)` usando Redis Hash `conv:status:{jobId}` com TTL configurável.
- **ADDED** Variável de ambiente `JOB_STATUS_TTL_SEC` (default 21600 = 6h) em `env.ts`.
- **MODIFIED** `apps/backend/src/modules/conversion/workers/conversion-job.worker.ts`: fase de atualização de status agora faz `HSET` em Redis (live); ao concluir/falhar/cancelar, faz `UPDATE` em Postgres (durável) + `DEL` no Redis.
- **MODIFIED** `apps/backend/src/modules/conversion/repositories/prisma-conversion.repository.ts` `syncStatus()`: para cada Job, busca status live em Redis primeiro; Jobs em estado terminal (complete/failed/cancelled) usam snapshot do Postgres; Jobs running usam live do Redis; mescla e regrava agregados em Postgres.
- **MODIFIED** `apps/backend/src/modules/conversion/use-cases/cancel-conversion.use-case.ts` em modo `prisma`: escreve `status='cancelled'` no Redis HSET primeiro (worker detecta em <1s); depois persiste `UPDATE` em Postgres.
- **MODIFIED** `apps/backend/src/modules/conversion/workers/conversion-job.worker.ts` detecção de cancelamento: lê `HGET conv:status:{jobId} status` (Redis) a cada capítulo (baixo custo — O(1)) em vez de `SELECT` no Postgres.
- **MODIFIED** `apps/backend/src/modules/conversion/services/image-downloader.service.ts`: continua lendo placeholders do source repo (Sem mudança introduzida por esta change).
- **ADDED** Testes para `JobLiveStatusStore` (mock ioredis) e para fluxo live+terminal no worker.

## Capabilities

### New Capabilities

- `redis-live-job-status`: habilidade de manter status transitório de Job em Redis Hash (com TTL) para o hot path, sincronizando com Postgres apenas em transições terminais. Inclui o comportamento de `syncStatus()` mesclando Redis live + Postgres durável (shape de retorno compatível).

### Modified Capabilities

<!-- Nenhum — `prisma-conversion-repository` ainda está como change ativa (não arquivada); suas evoluções nesta change são absorvidas como parte da nova capability `redis-live-job-status`. -->

## Impact

- **Arquivos novos:**
  - `apps/backend/src/shared/redis/job-status-store.ts`
  - `apps/backend/src/shared/redis/tests/job-status-store.test.ts`
- **Arquivos modificados:**
  - `apps/backend/src/shared/config/env.ts` (adiciona `JOB_STATUS_TTL_SEC`)
  - `apps/backend/src/modules/conversion/repositories/prisma-conversion.repository.ts` (syncStatus híbrido)
  - `apps/backend/src/modules/conversion/workers/conversion-job.worker.ts` (status updates via Redis live + sync terminal p/ Postgres)
  - `apps/backend/src/modules/conversion/use-cases/cancel-conversion.use-case.ts` (escrita Redis-first)
- **Depende de:** `migrate-conversions-and-jobs-to-postgres` (req Prisma job repo).
- **Reduz contention em SSE polling** — `syncStatus` dá N HGETALL baratos.
- **Risco:** Se Redis rebooot entre worker updates e sync terminal, live status vazio. Mitigação: snapshot final sempre persiste em Postgres; journal SSE (List com TTL 1h) já dá replay; syncStatus usa Postgres como truth fallback quando Redis vazio.