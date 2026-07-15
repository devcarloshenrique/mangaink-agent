## 1. Adapter Prisma Conversion

- [x] 1.1 Criar `apps/backend/src/modules/conversion/repositories/prisma-conversion.repository.ts` implementando `ConversionRepository`.
- [x] 1.2 Implementar `create(config)` como `prisma.conversion.create` (Conversion row). Jobs são criados separadamente via `PrismaJobRepository.create()`.
- [x] 1.3 Implementar `findById(conversionId)` retornando `ConversionState` shape-compatible (`include: { jobs: { orderBy: { book_index: 'asc' } } }`).
- [x] 1.4 Implementar `update(conversionId, partial)` para patch de campos escalares (status, progress, contadores, completedAt, finishedAt, error) — não expor `updateConfig`.
- [x] 1.5 Implementar `syncStatus(conversionId)`: query agregada em `conversion_jobs` + `UPDATE conversions` em transação.
- [x] 1.6 Implementar `listJobIds(conversionId)` retornando `job_id[]`.
- [x] 1.7 Implementar `appendLog(conversionId, line)` — continua escrevendo em filesystem (`storage/conversions/{conv}/logs/conversion.log`).
- [x] 1.8 Implementar `delete(conversionId)` — `DELETE FROM conversions` cascade nos Jobs; binários NÃO tocados.

## 2. Adapter Prisma Job

- [x] 2.1 Criar `apps/backend/src/modules/conversion/repositories/prisma-job.repository.ts` implementando `ConversionJobRepository`.
- [x] 2.2 Implementar `withConversion(conversionId)`: retorna nova instância com `scopedConversionId` guardado internamente.
- [x] 2.3 Implementar `create(jobConfig)`: `prisma.conversionJob.create({...})` — resolve FK via business ID → UUID lookup.
- [x] 2.4 Implementar `findById(jobId)`: retorna `ConversionJobState` shape-compatible com `include: { conversion: { select: { conversionId } } }`.
- [x] 2.5 Implementar `update(jobId, partial)`: `UPDATE conversion_jobs SET ... WHERE job_id=$1`.
- [x] 2.6 Garantir que **nenhum** `config.json`/`status.json` é escrito no disco em modo Prisma.

## 3. Composer

- [x] 3.1 Atualizar `apps/backend/src/shared/database/repositories/index.ts`: `getConversionRepository()` e `getConversionJobRepository()` retornam instâncias Prisma em modo Prisma.

## 4. Worker — Branch por REPO_BACKEND

- [x] 4.1 Em `apps/backend/src/modules/conversion/workers/conversion-job.worker.ts`, ler `isPrismaBackend()` para decidir repositório.
- [x] 4.2 Path Prisma: usar repos via composer para todas transições de fase.
- [x] 4.3 Path Prisma: detects cancelamento via `jobRepo.findById(jobId).status === 'cancelled'` (interface já usada no worker).
- [x] 4.4 Path Prisma: ao concluir com sucesso, persistir `outputFile`, `outputSize`, `downloadUrl`, `completedAt=NOW`.
- [x] 4.5 Path Filesystem: manter código atual sem change.

## 5. CancelConversionUseCase — Branch por REPO_BACKEND

- [x] 5.1 Em `apps/backend/src/modules/conversion/use-cases/cancel-conversion.use-case.ts`, branquear por `isPrismaBackend()`.
- [x] 5.2 Path Prisma: `jobRepo.update(jobId, { status: 'cancelled', currentStep: 'Cancelled' })` + `queue.remove(jobId)`.
- [x] 5.3 Chamar `syncStatus()` ao final.
- [x] 5.4 Path Filesystem: manter comportamento atual.

## 6. Testes

- [x] 6.1 `prisma-conversion.repository.test.ts` — 9 testes: create/findById, update, syncStatus (processing/completed/partial), listJobIds, delete cascade.
- [x] 6.2 `prisma-job.repository.test.ts` — 6 testes: create/findById, update status/output, withConversion.
- [x] 6.3 Testes E2E existentes continuam passando em modo Filesystem (default).
- [x] 6.4 Testes de use-case cancelamento mantidos (pré-existentes).

## 7. Validação

- [x] 7.1 `pnpm build:backend` sem erros TypeScript nos novos arquivos (erros pré-existentes em testes não relacionados).
- [x] 7.2 `pnpm test` — 365/366 testes passam (1 falha pré-existente em cancel-conversion.use-case.test.ts).
- [x] 7.3 Novos testes Prisma convertidos rodam com `--no-file-parallelism` (shared PostgreSQL).
- [ ] 7.4 Smoke em `REPO_BACKEND=prisma`: requer stack completa (Redis + BullMQ).
- [ ] 7.5 Smoke em `REPO_BACKEND=filesystem`: regressão confirmada via testes existentes.