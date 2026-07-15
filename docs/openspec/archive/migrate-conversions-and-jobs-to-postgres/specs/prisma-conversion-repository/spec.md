## ADDED Requirements

### Requirement: Adaptador Prisma para ConversionRepository
The system MUST provide a Prisma-backed implementation of the existing `ConversionRepository` interface, selectable via `REPO_BACKEND=prisma`, persisting Conversion configs and aggregated status in PostgreSQL.

#### Scenario: create insere Conversion + Jobs em transação
- **WHEN** `PrismaConversionRepository.create(config)` é chamado com `userId`, `sourceId`, `books[]` e `options`
- **THEN** é executada uma transação Prisma que faz `prisma.conversion.create(...)` e `prisma.conversionJob.create(...)` para cada book
- **THEN** a Conversion é criada com `status="queued"`, `progress=0`, contadores `total_jobs=N`, demais contadores em 0
- **THEN** cada Job é criado com `status="queued"`, `progress=0`, `book_index=$i` e snapshot imutável de config (`chapters`, `cover`, `output`, `metadata`, `options`, `error_handling_strategy`)
- **THEN** a operação é atômica: falha em qualquer Job reverte tudo

#### Scenario: findById retorna Conversion com Jobs
- **WHEN** `PrismaConversionRepository.findById(conversionId)` é chamado
- **THEN** retorna objeto shape-compatível com `ConversionState` (incluindo `config`, `status`, `progress`, contadores, `jobs[]`)
- **THEN** `jobs[]` retorna ordenado por `book_index`
- **THEN** para Conversion inexistente retorna `null`
- **THEN** quando invocado por usuário não-dono (`userId` divergente), o use-case (não o adapter) deve retornar 403 — o adapter retorna o registro cru para que o use-case valide ownership

#### Scenario: update syncStatus calcula agregados via Prisma
- **WHEN** `PrismaConversionRepository.syncStatus(conversionId)` é chamado
- **THEN** executa `SELECT id, status, progress, completed_at, error FROM conversion_jobs WHERE conversion_id=$1 ORDER BY book_index`
- **THEN** computa `status`, `progress` (média), `completedJobs`, `failedJobs`, `runningJobs`, `pendingJobs`, `finishedAt` (quando todos Jobs em estado terminal)
- **THEN** executa `UPDATE conversions SET status=$1, progress=$2, completed_jobs=$3, ..., updated_at=NOW(), finished_at=$4 WHERE id=$5` em uma transação
- **THEN** retorna o `ConversionState` recomputado
- **THEN** em modo Prisma **não** há leitura de `status.json` por Job no disco

#### Scenario: update atómico de Job
- **WHEN** o worker chama `PrismaJobRepository.update(jobId, partial)` (com subset de campos)
- **THEN** executa `UPDATE conversion_jobs SET ... WHERE job_id=$1` (apenas campos fornecidos)
- **THEN** não sobrescreve `config` columns imutáveis

#### Scenario: delete em cascata
- **WHEN** `PrismaConversionRepository.delete(conversionId)` é chamado
- **THEN** executa `DELETE FROM conversions WHERE id=$1` com `ON DELETE CASCADE` em `conversion_jobs` (FK)
- **THEN** binários no filesystem (`storage/conversions/{conv}/jobs/*/output/*.epub` etc.) **não** são removidos por esta operação (responsabilidade do endpoint de purge / cleanup)

### Requirement: Compatibilidade de interface sem withConversion filesystem scoping
The system MUST maintain the `withConversion(conversionId)` method on the Job repository interface, but in Prisma mode it MUST be a no-op or thin pass-through because scoping is handled by the FK.

#### Scenario: withConversion em modo Prisma
- **WHEN** `getConversionJobRepository().withConversion(conversionId)` é chamado em modo Prisma
- **THEN** retorna o próprio adapter (ou um thin wrapper) já escopado implicitamente pela FK
- **THEN** operações subsequentes (`create`, `findById`, `update`) usam `conversionId` para definir/constranger queries
- **THEN** nenhum diretório `{root}/{conversionId}/jobs/` é criado

#### Scenario: withConversion em modo Filesystem (compatibilidade)
- **WHEN** o mesmo método é chamado em modo Filesystem
- **THEN** mantém o comportamento atual (escopo como path prefix)
- **THEN** testes existentes continuam passando sem alteração

### Requirement: Persistência de output artefacts em Postgres mas binários em filesystem
The system MUST persist Job output metadata (`outputFile`, `outputSize`, `downloadUrl`) in the `conversion_jobs` row, while the actual EPUB/MOBI/CBZ file remains on the filesystem.

#### Scenario: Worker completa Job em modo Prisma
- **WHEN** o worker termina o KCC com sucesso
- **THEN** retorna `outputFile`, `outputSize`, `downloadUrl`
- **THEN** grava esses campos via `PrismaJobRepository.update(jobId, { status: "completed", progress: 100, outputFile, outputSize, downloadUrl, completedAt: NOW })`
- **THEN** o binário EPUB permanece em `storage/conversions/{conv}/jobs/{job}/output/<sanitized>.epub`
- **THEN** o caminho no disco é derivável a partir de `conversionId` + `jobId` + `outputFile`

#### Scenario: Serviço de download permanece filesystem-aware
- **WHEN** qualquer endpoint serve o EPUB
- **THEN** lê o binário do filesystem usando `conversionId` + `jobId` + `outputFile` (registrados no DB)
- **THEN** este caminho não depende de `REPO_BACKEND`

### Requirement: Cancelamento atualiza estado no DB em modo Prisma
The system MUST update the Conversion/Job status in the database when a cancellation is requested in Prisma mode, while preserving the existing filesystem path in legacy mode.

#### Scenario: CancelConversionUseCase em modo Prisma
- **WHEN** o use-case é chamado em modo Prisma
- **THEN** remove Jobs pendentes via BullMQ (`queue.remove(jobId)`)
- **THEN** para Jobs `running`, escreve `UPDATE conversion_jobs SET status='cancelled', updated_at=NOW() WHERE job_id=$1 AND status IN ('queued','preparing','downloading','converting','packaging')`
- **THEN** chama `syncStatus()` que regrava `conversions.status='cancelled'` quando resto dos Jobs está todo em estado terminal
- **THEN** retorna `{ conversionId, status: "cancelled" }`

#### Scenario: Detecção de cancelamento em mid-flight (modo Prisma)
- **WHEN** o worker em execução precisa saber se o Job foi cancelado
- **THEN** durante o loop de download, consulta `SELECT status FROM conversion_jobs WHERE job_id=$1` a cada iteração (debounce ≈1s) e aborta se `status='cancelled'`
- **THEN** esta leitura é leve (uma query com PK) — não causa contenção

### Requirement: Worker escreve estado em Postgres quando REPO_BACKEND=prisma
The system MUST branch the worker's status persistence on `REPO_BACKEND`: Prisma mode writes to the `conversion_jobs` table; filesystem mode writes to the existing `status.json` files.

#### Scenario: Worker em modo Prisma
- **WHEN** `isPrismaBackend()` retorna `true`
- **THEN** o worker obtém o `ConversionJobRepository` do composer e chama `update(jobId, {...})`
- **THEN** nenhum `status.json` por Job é escrito em disco
- **THEN** nenhum `config.json` por Job é escrito em disco (configs ficam no row do DB)

#### Scenario: Worker em modo Filesystem
- **WHEN** `isPrismaBackend()` retorna `false`
- **THEN** o worker mantém o comportamento atual (escreve `status.json` e `config.json` por Job)
- **THEN** testes E2E atuais continuam passando sem alteração