## 1. Adapter Prisma Conversion

- [ ] 1.1 Criar `apps/backend/src/modules/conversion/repositories/prisma-conversion.repository.ts` implementando `ConversionRepository`.
- [ ] 1.2 Implementar `create(config)` como `prisma.$transaction` (`conversion.create` + bulk `conversionJob.createMany`).
- [ ] 1.3 Implementar `findById(conversionId)` retornando `ConversionState` shape-compatible (`include: { jobs: { orderBy: { book_index: 'asc' } } }`).
- [ ] 1.4 Implementar `update(conversionId, partial)` para patch de campos escalares (status, progress, contadores, completedAt, finishedAt, error) — não expor `updateConfig`.
- [ ] 1.5 Implementar `syncStatus(conversionId)`: query agregada em `conversion_jobs` + `UPDATE conversions` em transação.
- [ ] 1.6 Implementar `listJobIds(conversionId)` retornando `job_id[]` (usado pelo `connectConversionToSSE`).
- [ ] 1.7 Implementar `appendLog(conversionId, line)` — em modo Prismaignite opcional: armazenar logs em Redis List OU escrever em arquivo legado (`logs/conversion.log`) — implementação mínima: continua escrevendo em filesystem (caminho `storage/conversions/{conv}/logs/conversion.log`) para coexistir com modo filesystem.
- [ ] 1.8 Implementar `delete(conversionId)` — `DELETE FROM conversions` cascade nos Jobs; binários NÃO tocados.

## 2. Adapter Prisma Job

- [ ] 2.1 Criar `apps/backend/src/modules/conversion/repositories/prisma-job.repository.ts` implementando `ConversionJobRepository`.
- [ ] 2.2 Implementar `withConversion(conversionId)`: retorna `this` (no-op); o `conversionId` é guardado em field interno quando necessário.
- [ ] 2.3 Implementar `create(jobConfig)`: `prisma.conversionJob.create({...})` — insere na tabela `conversion_jobs`.
- [ ] 2.4 Implementar `findById(jobId)`: retorna `ConversionJobState` shape-compatible.
- [ ] 2.5 Implementar `update(jobId, partial)`: `UPDATE conversion_jobs SET ... WHERE job_id=$1` comsubset de campos (`status`, `progress`, `current_step`, `downloaded_images`, `total_images`, `error`, `download_url`, `output_file`, `output_size`, `completed_at`).
- [ ] 2.6 Garantir que **nenhum** `config.json`/`status.json` é escrito no disco em modo Prisma.

## 3. Composer

- [ ] 3.1 Atualizar `apps/backend/src/shared/database/repositories/index.ts`: `getConversionRepository()` e `getConversionJobRepository()` retornam instâncias Prisma em modo Prisma (substituindo placeholders).

## 4. Worker — Branch por REPO_BACKEND

- [ ] 4.1 Em `apps/backend/src/modules/conversion/workers/conversion-job.worker.ts`, ler `isPrismaBackend()` para decidir repositório.
- [ ] 4.2 Path Prisma: usar `jobRepo.update(jobId, partial)` para todas transições de fase (preparing → downloading → converting → packaging → completed/failed).
- [ ] 4.3 Path Prisma: detects cancelamento via `jobRepo.findById(jobId).status === 'cancelled'` a cada capítulo baixado (não a cada imagem).
- [ ] 4.4 Path Prisma: ao concluir com sucesso, persistir `outputFile`, `outputSize`, `downloadUrl`, `completedAt=NOW`. Binário EPUB permanece em disco inalterado.
- [ ] 4.5 Path Filesystem: manter código atual sem change.

## 5. CancelConversionUseCase — Branch por REPO_BACKEND

- [ ] 5.1 Em `apps/backend/src/modules/conversion/use-case/cancel-conversion.use-case.ts`, branquear por `isPrismaBackend()`.
- [ ] 5.2 Path Prisma: `UPDATE conversion_jobs SET status='cancelled' WHERE job_id IN (...) AND status IN ('queued','preparing','downloading','converting','packaging')` + `queue.remove(jobId)` para pendentes.
- [ ] 5.3 Chamar `syncStatus()` ao final.
- [ ] 5.4 Path Filesystem: manter comportamento atual (edita `status.json` por Job).

## 6. Testes

- [ ] 6.1 `apps/backend/src/modules/conversion/tests/prisma-conversion.repository.test.ts` — cobertura:
  - `create` com 3 books → cria 1 Conversion + 3 Jobs (contadores inicializados)
  - `findById` com `include jobs` ordenados por `book_index`
  - `findById` retorna `null` para inexistente
  - `syncStatus` calcula `processing` quando há running + queued
  - `syncStatus` calcula `completed` quando todos Jobs em terminal
  - `syncStatus` calcula `partial` quando há failed + completed
  - `syncStatus` preenche `finishedAt` quando terminal
  - `delete` remove Conversion + Jobs em cascade (binários não tocados)
- [ ] 6.2 `apps/backend/src/modules/conversion/tests/prisma-job.repository.test.ts` — cobertura:
  - `create` insere row com `status='queued'`
  - `update` patch de `status='converting'`, `progress=42` (não sobrescreve `chapters`/`options`)
  - `update` com `outputFile`, `outputSize` ao concluir
  - `findById` shape-compatible
  - `withConversion` não quebra
- [ ] 6.3 Garantir que testes E2E atuais do modulo conversion continuam passando em modo Filesystem (default).
- [ ] 6.4 Adicionar testes de use-case em modo Prisma (mock repos Prisma com in-memory que retorna shape DB) para cancelamento.

## 7. Validação

- [ ] 7.1 `pnpm build:backend` sem erros TypeScript.
- [ ] 7.2 `pnpm test` — todos testes existentes + novos passam.
- [ ] 7.3 Smoke em `REPO_BACKEND=prisma`: dispara `POST /api/conversions` → confirma row em `pnpm db:studio` (tabelas `conversions`/`conversion_jobs` populates); `GET /api/conversions/:id` funciona.
- [ ] 7.4 Smoke em `REPO_BACKEND=filesystem`: fluxo atual sem regressões (`status.json` continua sendo escrito).