# embedded-conversion-status-store Specification

## Purpose
TBD - created by archiving change desktop-embedded-conversion-500. Update Purpose after archive.
## Requirements
### Requirement: Default seguro por modo dos status stores

`JobLiveStatusStore` e `MobiPreviewStatusStore` SHALL selecionar o adapter de `IStatusStore` por default conforme o modo do backend: `InMemoryStatusStore` quando `MI_EMBEDDED_MODE=1` (ou `true`), `RedisStatusStoreAdapter` caso contrário. O default NUNCA SHALL abrir conexão Redis nem lançar em modo embedded; no modo web o comportamento atual com Redis Hash SHALL ser preservado. A injeção explícita no construtor (parâmetro `store`) SHALL continuar sobrepondo o default.

#### Scenario: Construção default em modo embedded

- **WHEN** `JobLiveStatusStore` (ou `MobiPreviewStatusStore`) é construído sem argumentos com `MI_EMBEDDED_MODE=1`
- **THEN** a instância usa `InMemoryStatusStore` e `set`/`get` funcionam sem Redis, sem lançar

#### Scenario: Construção default em modo web

- **WHEN** `JobLiveStatusStore` é construído sem argumentos sem `MI_EMBEDDED_MODE`
- **THEN** a instância usa `RedisStatusStoreAdapter` (comportamento atual preservado)

#### Scenario: Injeção explícita sobrepõe

- **WHEN** o construtor recebe um `IStatusStore` explícito
- **THEN** o store injetado é usado independentemente de `MI_EMBEDDED_MODE`

### Requirement: syncStatus do repositório de conversão sem Redis em embedded

`PrismaConversionRepository` SHALL aceitar um `IStatusStore` opcional no construtor e usá-lo no `syncStatus()` via `JobLiveStatusStore` (default seguro do store aplicado quando ausente). `syncStatus()` MUST nunca abrir conexão Redis quando `MI_EMBEDDED_MODE=1`, mesmo com jobs não-terminais (queued/downloading/converting), devolvendo o estado agregado normalmente. `getConversionRepository(statusStore?)` (em `shared/database/repositories`) SHALL repassar o store opcional.

#### Scenario: GET de conversão com job não-terminal em embedded

- **WHEN** `GET /api/conversions/:conversionId` é chamado em modo embedded com pelo menos um job em estado não-terminal
- **THEN** a resposta é 200 com o estado agregado (sem `Internal Server Error`)

#### Scenario: merge do status live

- **WHEN** o store de status contém progresso live para um job não-terminal (ex.: status `downloading`, progress `42`)
- **THEN** `syncStatus` devolve o job com status/progresso do store live mesclado sobre o registro do banco

#### Scenario: Modo web inalterado

- **WHEN** o backend roda em modo web (sem `MI_EMBEDDED_MODE`)
- **THEN** `syncStatus` continua lendo o status live do Redis Hash, como hoje

### Requirement: Instância de status compartilhada via composition root

Os composition roots SHALL passar `runtime.status` para `getConversionRepository()` — `buildConversionDeps` em `conversion.routes.ts` e os workers `conversion-job.worker.ts` e `download-only.worker.ts` (incluindo os `onFailed`) — garantindo que repositório, workers e cancelamento compartilhem a MESMA instância in-memory em modo embedded. Sem runtime (registro standalone), o default do repositório SHALL ser o adapter seguro por modo (Requisito anterior).

#### Scenario: Progresso live visível na página de conversão

- **WHEN** um job está em `downloading` (worker escreve no `runtime.status`) e `GET /api/conversions/:conversionId` é chamado
- **THEN** a resposta reflete `downloading` com o progresso atual (mesma instância do status store)

#### Scenario: Registro standalone

- **WHEN** as rotas são registradas sem `runtime` (backend web standalone)
- **THEN** o repositório usa o default web (Redis) e o comportamento atual é mantido

### Requirement: Cobertura de teste de regressão

O change SHALL incluir: (a) teste unitário da seleção de default dos status stores por modo; (b) teste unitário de `PrismaConversionRepository.syncStatus` com `getPrisma` mockado e store in-memory — jobs não-terminais não lançam e progresso live é mesclado; (c) teste E2E embedded que exercita o caminho real (rotas → use-case → repositório → status store) com `getPrisma()` fake, cobrindo POST /api/conversions → 202, GET com job queued/downloading → 200, job terminal → completed, GET /logs → 200 e POST cancel → 200. O teste (c) MUST não mockar `getConversionRepository()` (é o objeto de regressão).

#### Scenario: Regressão detectada

- **WHEN** o código volta a construir `JobLiveStatusStore` com default Redis dentro do repositório em modo embedded
- **THEN** o teste E2E de regressão falha (GET devolve 500)

#### Scenario: Suíte verde

- **WHEN** o change é implementado
- **THEN** os testes unitários e o E2E embedded de regressão passam, e os demais testes do backend/desktop seguem verdes

### Requirement: Documentação do armazenamento de arquivos

`CLAUDE.md` SHALL documentar a árvore de diretórios onde os arquivos baixados (cache de scraping) e gerados (saída da conversão, logs, temp/preview MOBI) são persistidos, tanto no app desktop (`%APPDATA%/MangaInk Agent/storage/` — modo embedded e portable) quanto na stack web (`apps/backend/storage/`).

#### Scenario: Localização da saída da conversão

- **WHEN** um usuário consulta a documentação
- **THEN** encontra o caminho exato do arquivo final (`storage/conversions/{conversionId}/jobs/{jobId}/output/{título}.{ext}`) e dos demais artefatos

#### Scenario: Localização das imagens baixadas

- **WHEN** um usuário consulta a documentação
- **THEN** encontra o caminho do cache de scraping (`storage/sources/{sourceId}/chapters/{chapterId}/`) e de capas/metadados

