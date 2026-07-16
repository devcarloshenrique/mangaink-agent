## 1. Infraestrutura de Script

- [ ] 1.1 Criar `apps/backend/src/scripts/backfill-from-filesystem.ts` com entrypoint CLI (parse args via `process.argv`: `--dry-run`, `--force`, `--source-id=<id>` opcional para debug).
- [ ] 1.2 Inicializar instâncias `PrismaSourceRepository`, `PrismaConversionRepository`, `PrismaJobRepository` (ou usar Prisma Client diretamente para bulk performance).
- [ ] 1.3 Inicializar `JobLiveStatusStore`/`getRedis()` para checkpoint.
- [ ] 1.4 Helper `markDone(id)`, `isDone(id)`, `expire` em 24h.
- [ ] 1.5 Helper `readJsonSafe(filePath)` retornando `{ data | null, error? }`.
- [ ] 1.6 Logger estruturado em stdout (com timestamps) e acumulador de relatório final.

## 2. Backfill de Sources

- [ ] 2.1 Implementar `backfillSource(sourceId, filePath)`:
  - Lé `metadata.json`
  - Upsert em `sources` via Prisma
  - Bulk upsert em `chapters` (chunks de 50)
  - Bulk upsert em `covers` (chunks de 50)
  - Para cada `chapters/{chapterId}/images.json` existente → `UPDATE chapters SET placeholder_page_indices = $1 WHERE chapter_id = $chapterId`
- [ ] 2.2 Skip se `isDone(sourceId)` (a menos que `--force`).
- [ ] 2.3 Marca `done` ao final.
- [ ] 2.4 Loga sucesso/falha por source.
- [ ] 2.5 Em `--dry-run`, apenas imprime plano sem chamar Prisma.

## 3. Backfill de Conversions e Jobs

- [ ] 3.1 Implementar `backfillConversion(conversionId, dirPath)`:
  - Lê `config.json` (incluindo `userId`)
  - Se `userId` missing → warning + skip
  - Upsert em `conversions` (incluindo `cover`, `output`, `metadata`, `books`, `options`, `error_handling_strategy`, datas)
  - Lê `status.json` agregado → `UPDATE conversions SET status, progress, contadores, finished_at` ...
  - Para cada `jobs/{jobId}/`:
    - Lê `config.json` + `status.json` por Job
    - Upsert em `conversion_jobs` com snapshot final (incluindo `output_file`, `output_size`, `download_url`)
- [ ] 3.2 Skip se `isDone(conversionId)`.
- [ ] 3.3 Mark `done`.
- [ ] 3.4 Loga sucesso/falha por conversion.

## 4. Cleanup de JSONs Legados

- [ ] 4.1 Criar `apps/backend/src/scripts/cleanup-legacy-json-fields.ts` com subcomandos: `metadata`, `status`, e `--dry-run`, `--force`, `--purge-logs`.
- [ ] 4.2 Para `metadata`:
  - Para cada `storage/sources/{sourceId}/metadata.json`: `if (repository.exists(sourceId)) { delete metadata.json; delete images.json per chapter } else { warn + skip }`
- [ ] 4.3 Para `status`:
  - Para cada `storage/conversions/{conv}/config.json` + `status.json`: `if (conversionRepo.findById(conv)) { delete config.json, status.json; for each job: delete config.json, status.json; if !--purge-logs preserve logs } else { warn + skip }`
- [ ] 4.4 Em `--dry-run`, imprime lista sem deletar.
- [ ] 4.5 Confirmar que binários (`*.webp`, capas, EPUBs) são intocados (garantir glob exclude).

## 5. Scripts em package.json

- [ ] 5.1 Adicionar em `apps/backend/package.json`:
  - `"backfill": "tsx src/scripts/backfill-from-filesystem.ts"`
  - `"cleanup:legacy-metadata": "tsx src/scripts/cleanup-legacy-json-fields.ts metadata"`
  - `"cleanup:legacy-status": "tsx src/scripts/cleanup-legacy-json-fields.ts status"`
- [ ] 5.2 Adicionar na raiz `package.json` scripts `pnpm backfill`, `pnpm cleanup:legacy-metadata`, `pnpm cleanup:legacy-status` (delegando para `apps/backend`).

## 6. Documentação

- [ ] 6.1 Criar `docs/migracao-json-para-postgres.md` com:
  - Pré-requisitos: Docker/Postgres/Redis no ar; workers pausados; latest migration aplicada.
  - Passo 1: `pnpm backfill -- --dry-run` (preview).
  - Passo 2: `pnpm backfill` (executar — confirmar com prompt se não `--force`).
  - Passo 3: `pnpm db:studio` (verificar tabelas populadas).
  - Passo 4: Atualizar `.env` → `REPO_BACKEND=prisma`.
  - Passo 5: Reiniciar workers.
  - Passo 6: Verificar smoke endpoints (login, `GET /api/conversions`, `GET /api/conversions/:id`).
  - Passo 7 (opcional pós-N dias): cleanup legados.
  - Rollback: voltar `.env` para `REPO_BACKEND=filesystem` (JSONs ainda existentes até cleanup).
- [ ] 6.2 Atualizar `CLAUDE.md`:
  - Seção "Variáveis de Ambiente": notar `REPO_BACKEND` recomendado `prisma` pós-migração.
  - Referência ao runbook `docs/migracao-json-para-postgres.md`.

## 7. Testes

- [ ] 7.1 Criar `apps/backend/src/scripts/tests/backfill-from-filesystem.test.ts` (Vitest):
  - Backfill de uma source: upsert criou Source + chapters + covers + placeholderPageIndices.
  - Re-run é idempotente (queries upsert não duplicam).
  - `userId` missing em Conversion → pula.
  - JSON corrompido → falha logged, não crash.
  - `--dry-run` não executa writes.
  - Checkpoint via Redis marca done.
- [ ] 7.2 Criar testes para cleanup:
  - Cleanup metadata deleta JSONs quando Source exists.
  - Cleanup status deleta JSONs quando Conversion exists, preserva logs.
  - `--purge-logs` deleta logs também.
  - Filesystem binários não tocados (assert glob permanece).
  - `--dry-run` não deleta nada.
  - Aborta para itens sem correspondência em DB.

## 8. Validação

- [ ] 8.1 `pnpm build:backend` sem erros.
- [ ] 8.2 `pnpm test` — todos passam.
- [ ] 8.3 Dry-run local: gerar fixtures de `storage/sources/` + `storage/conversions/` e executar `pnpm backfill -- --dry-run` para preview.
- [ ] 8.4 Aplicar `pnpm backfill` em DB local → verificar `pnpm db:studio` que tabelas populates.
- [ ] 8.5 Trocar `REPO_BACKEND=prisma` → smoke endpoints sem regressão.
- [ ] 8.6 Rodar `pnpm cleanup:legacy-metadata -- --dry-run` → preview deletáveis.
- [ ] 8.7 Rodar cleanup atual → confirmar que binários permanecem e JSONs somem.