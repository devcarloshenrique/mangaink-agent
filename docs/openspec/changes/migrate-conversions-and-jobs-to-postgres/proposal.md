## Why

Hoje cada Conversão (`config.json` immutable + `status.json` agregado) e cada Job (`config.json` immutable + `status.json` mutável) vivem como arquivos JSON em `storage/conversions/{conv}/...`. `userId` está apenas em `config.json` — sem índice, sem listagem. O endpoint `GET /api/conversions` (a "Biblioteca") não existe ainda. Além disso o `syncStatus()` faz `O(jobs)` file reads a cada poll da API, criando contenção. Migrar configs/estado para Postgres coloca `userId`, `status`, e contadores como colunas indexadas — habilitando queries por usuário, status, data.

Esta change **persiste configs e estado agregado** em Postgres. **Não** introduz o novo endpoint de listagem (isto é a change `add-conversion-library-listing`) nem move o status quente para Redis (isto é `add-redis-live-job-status`). Mantém o `status.json` por Job no filesystem durante a transição (escrita frequente ainda via Filesystem mode); em modo Prisma o estado agregado e os configs moram em Postgres.

## What Changes

- **ADDED** `apps/backend/src/modules/conversion/repositories/prisma-conversion.repository.ts` implementando `ConversionRepository`.
- **ADDED** `apps/backend/src/modules/conversion/repositories/prisma-job.repository.ts` implementando `ConversionJobRepository` (com `withConversion()` mantido por compatibilidade, mas que retorna o mesmo adapter já escopado via FK — não há mais diretório raiz).
- **MODIFIED** `apps/backend/src/shared/database/repositories/index.ts`: `getConversionRepository()` e `getConversionJobRepository()` retornam instâncias Prisma em modo Prisma.
- **MODIFIED** `apps/backend/src/modules/conversion/repositories/filesystem-conversion.repository.ts` e `filesystem-job.repository.ts`: **mantidos sem alterações** (alternativa em filesystem mode).
- **MODIFIED** `apps/backend/src/modules/conversion/use-cases/create-conversion.use-case.ts` e `get-conversion.use-case.ts` e `cancel-conversion.use-case.ts`: **sem alteração** — consomem a interface.
- **MODIFIED** `apps/backend/src/modules/conversion/workers/conversion-job.worker.ts`: em modo Prisma persiste status do job via `PrismaJobRepository.update()` (em vez de `status.json`); em filesystem mantém o caminho atual.
- **MODIFIED** `apps/backend/src/modules/conversion/repositories/conversion.repository.ts` (interface): remover dependência de `syncStatus()` fazer I/O de arquivos quando em modo Prisma — método agora busca Jobs via Prisma e calcula agregados.
- **ADDED** Testes unitários para `PrismaConversionRepository` e `PrismaJobRepository` cobrindo create/findById/update/delete + syncStatus com Postgres local.

## Capabilities

### New Capabilities

- `prisma-conversion-repository`: adapter Prisma para `ConversionRepository` e `ConversionJobRepository` persistindo configs e estado agregado em Postgres.

### Modified Capabilities

<!-- Nenhum requisito de spec de comportamento muda — a API exposta permanece idêntica; apenas o storage backend alterna por flag. -->

## Impact

- **Arquivos novos:**
  - `apps/backend/src/modules/conversion/repositories/prisma-conversion.repository.ts`
  - `apps/backend/src/modules/conversion/repositories/prisma-job.repository.ts`
  - `apps/backend/src/modules/conversion/tests/prisma-conversion.repository.test.ts`
  - `apps/backend/src/modules/conversion/tests/prisma-job.repository.test.ts`
- **Arquivos modificados:**
  - `apps/backend/src/shared/database/repositories/index.ts`
  - `apps/backend/src/modules/conversion/workers/conversion-job.worker.ts` (escrita de status em DB quando em modo Prisma; cancelamento detecta via DB em readback)
  - `apps/backend/src/modules/conversion/use-cases/cancel-conversion.use-case.ts` (cancelamento escreve no DB em vez de `status.json` quando em Prisma mode; mesmo efeito para Job running)
- **Depende de:** `add-prisma-schema-and-repo-composition`.
- **Pode rodar em paralelo com:** `migrate-source-cache-to-postgres` (interfaces distintas).
- **Risco:** Worker precisa continuar detectando cancelamento em mid-flight — implementar polling do campo `status` no DB (debounce 1s) ou reusar Redis lock pattern para sinalizar.