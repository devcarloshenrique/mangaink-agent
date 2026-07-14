## Why

Após as changes anteriores introduzirem adapters Prisma (Source, Conversion, Jobs) e Redis live status, uma instância de produção ainda tem todos metadados em arquivos JSON no `storage/` — sem nada no Postgres. Para que `REPO_BACKEND=prisma` possa ser ligado em produção sem perda de histórico, é preciso um **backfill determinístico e idempotente** que leia os JSONs existentes e popule o Postgres, seguido de **cleanup** gradual dos artefatos legados. Esta change habilita o switch definitivo do `REPO_BACKEND` para `prisma` em produção.

## What Changes

- **ADDED** CLI script `apps/backend/src/scripts/backfill-from-filesystem.ts` rodável via `pnpm backfill`:
  - Varre `storage/sources/*/metadata.json` → upsert em `Source` + bulk upserts em `Chapter` e `Cover`.
  - Varre `storage/sources/*/chapters/*/images.json` → `UPDATE Chapter.placeholder_page_indices`.
  - Varre `storage/conversions/*/config.json` + `status.json` → upsert em `Conversion` + `ConversionJob`.
  - Varre `storage/conversions/*/jobs/*/config.json` + `status.json` → upsert em `ConversionJob` (snapshot final).
  - Suporta `--dry-run` (preview sem DB writes) e idempotência via upsert por IDs (`sourceId`, `conversionId`, `jobId`, `chapterId`, `coverId`).
  - Checkpoint por ID via Redis (`backfill:done:{id}` SET com TTL 24h) para retomar interrompidos.
- **ADDED** CLI script `apps/backend/src/scripts/cleanup-legacy-json-fields.ts` rodável via `pnpm cleanup:legacy-status`:
  - Apaga `status.json` por Job e por Conversion (após backfill confirmar snapshot em Postgres).
  - Apaga `metadata.json` por Source (após backfill confirmar Source em Postgres).
  - Apaga `images.json` por capítulo (após backfill confirmar `Chapter.placeholder_page_indices`).
  - Opcional `--keep-logs` (default true) preserva `logs/conversion.log` (auditoria).
  - **Não** apaga binários (`*.webp`, capas, EPUBs).
- **ADDED** Documentação `docs/migracao-json-para-postgres.md` (procedimento operacional passo-a-passo).
- **MODIFIED** `apps/backend/package.json`: adiciona scripts `backfill`, `backfill:dry-run`, `cleanup:legacy-status`, `cleanup:legacy-metadata`.
- **MODIFIED** `CLAUDE.md`: documenta procedure operacional + novo `REPO_BACKEND=prisma` como recomendado pós-migração.

## Capabilities

### New Capabilities

- `data-backfill-and-cleanup`: capacidade de migrar dados históricos do filesystem JSON para o Postgres de forma idempotente, com rollback seguro e limpeza opcional dos artefatos legados.

### Modified Capabilities

<!-- Nenhum — esta change apenas populates / prune dados; não altera specs dos módulos. -->

## Impact

- **Arquivos novos:**
  - `apps/backend/src/scripts/backfill-from-filesystem.ts`
  - `apps/backend/src/scripts/cleanup-legacy-json-fields.ts`
  - `apps/backend/src/scripts/README.md` (ou nota em `CLAUDE.md`)
  - `docs/migracao-json-para-postgres.md`
  - Scripts adicioneis em `apps/backend/package.json` (`backfill`, `cleanup:legacy-status`, `cleanup:legacy-metadata`, `cleanup:dry-run` flags)
- **Depende de:**
  - `migrate-source-cache-to-postgres` (adapter Prisma para Source).
  - `migrate-conversions-and-jobs-to-postgres` (adapter Prisma para Conversion/Job).
  - `add-redis-live-job-status` (para coexistência total em Prisma mode).
- **Pode ser executada offline**: stop workers, rodar backfill, switch `REPO_BACKEND=prisma`, restart workers.
- **Risco:** Backfill concluso entre re-scrape — corrida entre dados novos (Redis live) e dados backfill pode deixar snapshot terminal stale. Mitigação: rodar com workers parados.