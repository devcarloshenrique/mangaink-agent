## 1. Configuração

- [x] 1.1 Adicionar ao `apps/backend/src/shared/config/env.ts` (Zod): `JOB_STATUS_TTL_SEC: z.coerce.number().int().positive().default(21600)`.
- [x] 1.2 Atualizar `CLAUDE.md` seção "Variáveis de Ambiente".

## 2. JobLiveStatusStore

- [x] 2.1 Criar `apps/backend/src/shared/redis/job-status-store.ts`.
- [x] 2.2 Implementar `set(jobId, partial)`: `redis.hset(key, flatten(partial))` + `redis.expire(key, JOB_STATUS_TTL_SEC)`.
- [x] 2.3 Implementar `get(jobId)`: `redis.hgetall(key)` → mapear para tipado ou `null`.
- [x] 2.4 Implementar `clear(jobId)`: `redis.del(key)`.
- [x] 2.5 Implementar `setTerminal(jobId, terminalFields)` (alias utilit: faz `set` + garante `status` em estados terminais).
- [x] 2.6 Tipagem TypeScript estrita: `LiveJobStatus` em `shared/redis/job-status-store.ts` ou em `conversion/types.ts`.
- [x] 2.7 Reusar `getRedis()` singleton; ou criar conexão dedicada se necessário para avoiding blocking mode.

## 3. Worker — Branch Redis Live (modo prisma)

- [x] 3.1 Em `apps/backend/src/modules/conversion/workers/conversion-job.worker.ts`, ler `isPrismaBackend()` para decidir caminho live.
- [x] 3.2 When em modo Prisma: inicializar `JobLiveStatusStore` (via `getRedis()` ou injec dedicada).
- [x] 3.3 Transições de fase (`preparing → downloading → converting → packaging`) chamar `jobLiveStatusStore.set(jobId, { status, currentStep, updatedAt: new Date().toISOString() })`.
- [x] 3.4 Progress download chamar `jobLiveStatusStore.set(jobId, { downloadedImages, totalImages })` (debounced: 1 update por capítulo, não por imagem individual, para não sobrecarregar Redis).
- [x] 3.5 Ao atingir terminal (`completed`): persistir via `prismaJobRepository.update(jobId, terminalFields)` + `jobLiveStatusStore.clear(jobId)`.
- [x] 3.6 Ao atingir `failed`: idem (persistir `error` em Postgres + clear Redis).
- [x] 3.7 Ao detectar cancelamento via `HGET status === 'cancelled'`: abortar, persistir `status='cancelled'` em Postgres, chamar `clear(jobId)`.

## 4. CancelConversionUseCase — Redis-first

- [x] 4.1 Em `apps/backend/src/modules/conversion/use-cases/cancel-conversion.use-case.ts`, branquear por `isPrismaBackend()`.
- [x] 4.2 Path Prisma:
  - Para Jobs pendentes: `queue.remove(jobId)` + `jobLiveStatusStore.set(jobId, { status: 'cancelled', updatedAt: now })` (worker BullMQ não executa) + persistir em Postgres `UPDATE conversion_jobs SET status='cancelled' WHERE job_id=$1 AND status='queued'`.
  - Para Jobs running: `jobLiveStatusStore.set(jobId, { status: 'cancelled', updatedAt: now })` (worker detecta em próximo capítulo e faz persist terminal).
- [x] 4.3 Chamar `syncStatus()` ao final.
- [x] 4.4 Path Filesystem: manter fluxo atual.

## 5. syncStatus Híbrido

- [x] 5.1 Em `apps/backend/src/modules/conversion/repositories/prisma-conversion.repository.ts`, refator `syncStatus(conversionId)`:
  - Query `SELECT id, job_id, status FROM conversion_jobs WHERE conversion_id=$1 ORDER BY book_index` (Postgres).
  - Para cada Job, verifique estado:
    - Se estado terminal: usa row do Postgres (incluindo `progress`, `output_file`, etc., pode `SELECT` completo diretamente).
    - Se estado não-terminal: `jobLiveStatusStore.get(jobId)`; se live retornar dados, use-os; se `null`, fallback para último snapshot Postgres (que pode conter `status`/`progress` parciais).
- [x] 5.2 Computar status agregado, contadores, `progress` médio, `finishedAt` quando todos terminais.
- [x] 5.3 Persistir agregado em Postgres (`UPDATE conversions SET ...`) — continua durável.
- [x] 5.4 Retornar `ConversionState` com `jobs[]` mesclados (live + terminal).

## 6. Testes

- [x] 6.1 `apps/backend/src/shared/redis/tests/job-status-store.test.ts`:
  - `set` faz `HSET` + `EXPIRE` com TTL correto.
  - `get` retorna tipagem correta; `null` se chave inexistente.
  - `clear` deleta a chave.
  - TTL renovado em cada `set`.
- [x] 6.2 Testes de worker (mock `JobLiveStatusStore` + mock `PrismaJobRepository`):
  - Transições de fase escrevem no Redis (não Postgres).
  - Terminal: escreve Postgres + `clear` Redis.
  - Cancelamento detectado via Redis → aborta + persist terminal.
- [x] 6.3 Testes de `syncStatus` híbrido:
  - Mix de running (Redis) + terminal (Postgres) → agregado correto.
  - Redis vazio para Job running → fallback para snapshot Postgres.
  - Atualiza Postgres com agregados.
- [x] 6.4 Testes de `CancelConversionUseCase` em modo Prisma:
  - Redis-first detectado em before quando Job running.
  - Job pending removido da fila + persistido como cancelled.

## 7. Validação

- [x] 7.1 `pnpm build:backend` sem erros.
- [x] 7.2 `pnpm test` — todos passam.
- [x] 7.3 Smoke em `REPO_BACKEND=prisma`: disparar uma conversão de 3 capítulos → confirmar via `redis-cli HGETALL conv:status:{jobId}` que progress se atualiza durante download.
- [x] 7.4 Smoke em `REPO_BACKEND=filesystem`: confirmar que `HSET` nunca é chamado (worker ignora store).
- [x] 7.5 Smoke cancelamento em execução: confirmar que `HSET cancelled` resulta em próximo capítulo abortando.
- [x] 7.6 Confirmar que o SSE ainda emite eventos (Pub/Sub existente inalterado).