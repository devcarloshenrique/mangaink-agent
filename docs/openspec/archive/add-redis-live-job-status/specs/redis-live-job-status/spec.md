## ADDED Requirements

### Requirement: Store de status live de Job em Redis Hash
The system MUST provide a `JobLiveStatusStore` helper that stores transient Job status as a Redis Hash (`conv:status:{jobId}`) with configurable TTL, supporting atomic incremental updates.

#### Scenario: set incrementa campos
- **WHEN** `JobLiveStatusStore.set(jobId, { progress: 42, current_step: 'downloading' })` é chamado
- **THEN** execut `HSET conv:status:{jobId} progress 42 current_step downloading` no Redis
- **THEN** renova `EXPIRE conv:status:{jobId} <JOB_STATUS_TTL_SEC>` (default 21600s)

#### Scenario: get retorna todos os campos
- **WHEN** `JobLiveStatusStore.get(jobId)` é chamado
- **THEN** execut `HGETALL conv:status:{jobId}`
- **THEN** retorna objeto tipado (`status`, `progress`, `currentStep`, `downloadedImages`, `totalImages`, `error`, `updatedAt`) ou `null` se a chave não existe

#### Scenario: clear ao atingir estado terminal
- **WHEN** um Job atinge estado terminal (`completed`, `failed`, `cancelled`)
- **THEN** o worker chama `JobLiveStatusStore.clear(jobId)` que executa `DEL conv:status:{jobId}` após ter persistido o snapshot final em Postgres

#### Scenario: TTL reseta a cada atualização
- **WHEN** qualquer `HSET` é executado
- **THEN** `EXPIRE` é renovado para o TTL completo (não stacking) garantindo que chaves abandonadas expiram mesmo sem terminal explícito

### Requirement: Worker persiste status live em Redis durante execução
The system MUST update Job status via `JobLiveStatusStore` (Redis) during execution instead of issuing `UPDATE` on Postgres on every phase transition or progress tick, when running in `REPO_BACKEND=prisma` mode.

#### Scenario: Transições de fase escrevem no Redis
- **WHEN** o worker transita entre fases (`preparing` → `downloading` → `converting` → `packaging`)
- **THEN** chama `JobLiveStatusStore.set(jobId, { status, currentStep, updatedAt: ISO })` (Redis HSET)
- **THEN** **não** executa `UPDATE conversion_jobs` em cada transição

#### Scenario: Progresso de download escreve no Redis
- **WHEN** o worker atualiza `downloadedImages` ou `totalImages` durante download de capítulos
- **THEN** chama `JobLiveStatusStore.set(jobId, { downloadedImages, totalImages })` (Redis HSET)
- **THEN** não persiste em Postgres incremental

#### Scenario: Conclusão/falha write Postgres + clear Redis
- **WHEN** um Job atinge estado terminal (`completed`, `failed`, `cancelled`)
- **THEN** o worker persiste snapshot final em Postgres via `PrismaJobRepository.update(jobId, { status, progress: 100| ultimo, error?, outputFile?, outputSize?, downloadUrl?, completedAt: NOW })`
- **THEN** chama `JobLiveStatusStore.clear(jobId)` para limpar a chave Redis

### Requirement: Cancelamento writing Redis-first
The system MUST write cancellation status to Redis first (worker detects within seconds), then persist to Postgres as terminal snapshot.

#### Scenario: Cancelamento detectado em mid-flight
- **WHEN** `CancelConversionUseCase` (modo Prisma) cancela um Job running
- **THEN** chama `JobLiveStatusStore.set(jobId, { status: 'cancelled', updatedAt: now })` **antes** de qualquer `UPDATE` em Postgres
- **THEN** remove Job pendente da fila BullMQ via `queue.remove(jobId)`
- **THEN** o worker lê `JobLiveStatusStore.get(jobId).status` no loop de download (every chapter) e aborta se `cancelled`
- **THEN** ao abortar, worker persiste `UPDATE conversion_jobs SET status='cancelled'` como terminal + chama `JobLiveStatusStore.clear(jobId)`

#### Scenario: Detecção de cancelamento sem Postgres poll
- **WHEN** o worker precisa saber se foi cancelado
- **THEN** consulta `HGET conv:status:{jobId} status` (O(1) Redis)
- **THEN** **não** consulta `SELECT` no Postgres nesta fase

### Requirement: syncStatus mescla Redis live + Postgres durável
The system MUST modify `syncStatus()` to compute the Conversion aggregated state by merging Redis live status for running Jobs with Postgres snapshot for terminal Jobs.

#### Scenario: Jobs todos running
- **WHEN** `syncStatus(conversionId)` é chamado e todos Jobs estão em estado não-terminal (queued/preparing/downloading/converting/packaging)
- **THEN** lê `conversions` (Postgres) + lista `job_id[]` (Postgres) e faz `MGET` em massa (`HGETALL` por JobId) em Redis
- **THEN** computa status agregado, contadores e progresso médio a partir do live data
- **THEN** retorna `ConversionState` shape-compatible

#### Scenario: Mix de running e terminal
- **WHEN** alguns Jobs estão terminais (Postgres) e outros running (Redis)
- **THEN** usa snapshot do Postgres para terminal e live do Redis para running
- **THEN** se a chave Redis para um Job running estiver vazia (Redis reboot), cai para o último snapshot conhecido em Postgres (fallback durável)

#### Scenario: Agregados persistidos em Postgres
- **WHEN** `syncStatus` computa novos agregados (`status`, `progress`, contadores, `finishedAt`)
- **THEN** executa `UPDATE conversions SET ...` em Postgres (durável) — garantindo listagem e GET tenham last-known snapshot
- **THEN** ainda retorna o `ConversionState` para uso imediato

### Requirement: Variável de ambiente JOB_STATUS_TTL_SEC
The system MUST expose a `JOB_STATUS_TTL_SEC` environment variable to control the Redis Hash TTL for live Job status.

#### Scenario: Default
- **WHEN** `JOB_STATUS_TTL_SEC` não está definido
- **THEN** `env.ts` (Zod) aplica default `21600` (6h)

#### Scenario: Override
- **WHEN** `JOB_STATUS_TTL_SEC=86400` é definido
- **THEN** todas as atualizações `JobLiveStatusStore.set` aplicam `EXPIRE` de 86400 segundos

#### Scenario: Valor inválido
- **WHEN** `JOB_STATUS_TTL_SEC=abc` ou `-1`
- **THEN** startup falha com erro de parse Zod

### Requirement: Comportamento fallback em filesystem mode
The system MUST NOT use Redis live status when `REPO_BACKEND=filesystem` — filesystem mode keeps the existing `status.json` flow unaltered.

#### Scenario: Filesystem mode inalterado
- **WHEN** `REPO_BACKEND=filesystem`
- **THEN** o worker nunca chama `JobLiveStatusStore` (não é inicializado)
- **THEN** o `FilesystemConversionRepository.syncStatus()` continua lendo `status.json` por Job em disco
- **THEN** testes atuais continuam passando sem regressão