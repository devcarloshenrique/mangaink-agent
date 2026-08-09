## ADDED Requirements

### Requirement: Contratos de infraestrutura desacoplados

O backend SHALL expor contratos de domínio para fila, pub/sub, journal, status e lock em `apps/backend/src/shared/infra/`, sem referência a BullMQ/ioredis: `IQueueService` (add/getJob/removeJob), `IPubSub` (publish/subscribe/unsubscribe/subscribeMany/unsubscribeMany), `IJournalStore` (append/range/nextId/expire), `IStatusStore` (get → object|null / set com merge parcial / clear, com TTL) e `ILockService` (acquire(key) → boolean / release(key) / isLocked(key) → boolean, com TTL interno). Serviços e use-cases de scraping e conversion MUST consumir esses contratos (não instâncias BullMQ/ioredis diretamente). Os serviços `ConversionPubSubService` e `ChapterDownloadPubSubService` que hoje acumulam operações pub/sub e journal (`pubRpush`, `pubLrange`, `pubIncr`, `pubExpire`) MUST ser decompostos em `IPubSub` + `IJournalStore`.

#### Scenario: Serviço usa contrato, não Redis

- **WHEN** um serviço (ex.: `conversion-queue.service`) é inspecionado
- **THEN** ele depende apenas do contrato `IQueueService` e nenhuma importação de `bullmq`/`ioredis` aparece no serviço

#### Scenario: Dois adaptadores coexistem

- **WHEN** o módulo `shared/infra` é carregado
- **THEN** existem implementações Redis (comportamento atual) e in-memory para cada contrato, selecionáveis por fábrica

### Requirement: Seleção de runtime por env

O backend SHALL selecionar a implementação in-memory quando `MI_EMBEDDED_MODE=1` e a implementação Redis quando a variável estiver ausente ou for diferente de `1`. O composition root (`shared/server.ts` e fábricas de módulo) DEVE construir os adaptadores uma única vez e injetá-los nos serviços/workers.

#### Scenario: Modo embedded ativo

- **WHEN** o backend inicia com `MI_EMBEDDED_MODE=1`
- **THEN** nenhuma conexão Redis é aberta e todos os serviços usam os adaptadores in-memory

#### Scenario: Modo web (default)

- **WHEN** o backend inicia sem `MI_EMBEDDED_MODE`
- **THEN** o comportamento atual com Redis/BullMQ é mantido integralmente

### Requirement: Fila in-memory com paridade de semântica

O adaptador in-memory de fila SHALL entregar: processamento FIFO com concurrency **configurável por fila** (refletindo os valores reais: `inspect-source`/`download-only` com concurrency 3, `conversion-job` com concurrency 1), `attempts` com backoff exponencial (mesmos defaults atuais: 3 tentativas, 2000ms), `getJob(id)` e `removeJob(id)` (usados no cancelamento), e retenção de completos/falhos nos últimos N. `lockDuration` e `maxStalledCount` do BullMQ não se aplicam em single-process e SHALL ser documentados como no-op. Workers MUST virar factories iniciadas no `server.ts` (padrão `startChapterDownloadWorker`) quando hoje são instanciados em module scope. Os imports side-effect em `server.ts` que criam `new Worker(...)` com conexão Redis no load MUST ser removidos e substituídos por chamadas de factory condicionais.

#### Scenario: Retry com backoff exponencial

- **WHEN** um job falha e `attempts > 1`
- **THEN** o job é reprocessado após o backoff configurado, até esgotar as tentativas

#### Scenario: Cancelamento via getJob/remove

- **WHEN** o use-case de cancelamento chama `getJob(jobId)` e `removeJob(jobId)`
- **THEN** o job pendente é removido da fila e não é processado

#### Scenario: Concurrency respeitada

- **WHEN** N jobs são enfileirados com concurrency 1
- **THEN** apenas 1 job é processado por vez, na ordem de chegada

#### Scenario: Sem Redis em modo embedded

- **WHEN** um job completo/falho é removido da fila
- **THEN** o adaptador retém no máximo o número configurado de jobs por estado

### Requirement: Pub/sub, journal e status in-memory

O adaptador in-memory SHALL implementar pub/sub por canal via `EventEmitter` (incluindo `subscribeMany`/`unsubscribeMany` para fan-in de Conversion SSE), journal (append/range com IDs monotônicos `INCR` e TTL) e status stores (get retorna object|null, set faz **merge parcial de campos** preservando a semântica HSET/HGETALL do Redis Hash, clear remove a chave, TTL expirado automaticamente), preservando o contrato usado pelo replay SSE e pelos hashes de status live.

#### Scenario: SSE com replay de journal

- **WHEN** um cliente conecta ao `/events` depois de eventos já publicados
- **THEN** o replay devolve os eventos na ordem original via `range`

#### Scenario: TTL expira status

- **WHEN** um valor é escrito com TTL e o TTL expira
- **THEN** `get` devolve `null` para a chave expirada

#### Scenario: Assinatura de canal

- **WHEN** um serviço assina um canal e outro publica nele
- **THEN** o callback da assinatura é invocado com a mensagem publicada

### Requirement: Lock in-memory com TTL

O adaptador in-memory de lock SHALL implementar `acquire(key)` (retorna boolean; falha se já adquirido e não expirado; usa workerId interno, não expondo token ao chamador), `release(key)` (só libera se workerId confere), `isLocked(key) → boolean` e expiração automática do TTL. A API preserva a assinatura real do `RedisLockService` existente para evitar refatoração nos call-sites.

#### Scenario: Lock exclusivo

- **WHEN** dois acquires concorrem pela mesma chave
- **THEN** apenas o primeiro recebe `true` e o segundo recebe `false`

#### Scenario: Release com token

- **WHEN** `release` é chamado por um worker diferente do que adquiriu (workerId diverge)
- **THEN** o lock permanece adquirido

#### Scenario: TTL expira lock

- **WHEN** o TTL de um lock expira
- **THEN** um novo `acquire` para a mesma chave tem sucesso

### Requirement: Runner KCC e MOBI com implementação embedded

`KccRunnerService` e `MobiUnpackRunnerService` SHALL ser selecionáveis por fábrica (`MI_EMBEDDED_MODE`): a impl `docker` mantém o comportamento atual (web) e a impl `embedded` spawna `python.exe` diretamente (sem bind mounts, paths do host). O worker de conversão e o de preview MOBI MUST consumir a interface (não a classe concreta).

#### Scenario: Conversão em modo embedded

- **WHEN** um job de conversão roda com `MI_EMBEDDED_MODE=1`
- **THEN** o KCC é executado via `python.exe` com os paths do host e o arquivo de saída aparece em `outputPath`

#### Scenario: Extração MOBI em modo embedded

- **WHEN** um preview MOBI roda com `MI_EMBEDDED_MODE=1`
- **THEN** `extract_mobi.py` é executado via `python.exe` e o poll de `images/` reporta páginas conforme aparecem

#### Scenario: Docker continua no web

- **WHEN** um job de conversão roda sem `MI_EMBEDDED_MODE`
- **THEN** o fluxo atual de `docker run mangaink-kcc:10.3.0` é mantido
