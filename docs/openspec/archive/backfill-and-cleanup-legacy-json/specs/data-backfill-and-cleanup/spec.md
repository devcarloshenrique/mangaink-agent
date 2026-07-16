## ADDED Requirements

### Requirement: Backfill idempotente de Source
The system MUST provide a CLI script (`pnpm backfill`) that reads legacy `metadata.json` and `images.json` files from `storage/sources/` and upserts them into PostgreSQL without duplicating or corrupting existing data.

#### Scenario: Backfill de fonte única
- **WHEN** `pnpm backfill` é executado em uma instância com `storage/sources/src-abc-123/metadata.json`
- **THEN** o script lê o `metadata.json` e faz `upsert` em `sources` por `source_id`
- **THEN** faz bulk upsert em `chapters` para cada item em `chapters[]`
- **THEN** faz bulk upsert em `covers` para cada item em `covers[]`
- **THEN** se existir `storage/sources/src-abc-123/chapters/{chapterId}/images.json`, faz `UPDATE chapters SET placeholder_page_indices = $1 WHERE chapter_id = $2`

#### Scenario: Idempotência — backfill executado duas vezes
- **WHEN** `pnpm backfill` é executado novamente contra o mesmo `storage/`
- **THEN** nenhum registro é duplicado (upsert por IDs)
- **THEN** valores são sobrescritos com o último snapshot do JSON (igual ao anterior se inalterado)

#### Scenario: Dry-run não escreve no DB
- **WHEN** `pnpm backfill -- --dry-run` é executado
- **THEN** o script percorre todos arquivos e imprime no stdout o que seria upserted/updated
- **THEN** **não** executa nenhuma escrita no Postgres ou Redis

#### Scenario: Checkpoint via Redis
- **WHEN** o backfill é interrompido (Ctrl-C) no meio do processamento
- **THEN** IDs já processados estão marcados em Redis via `SET backfill:done:{sourceId|conversionId} 1 EX 86400`
- **THEN** ao retomar, o script pula IDs já marcados no checkpoint
- **THEN** o checkpoint expira em 24h ( TTL), permitindo reprocessar após janela de dbg

#### Scenario: Backfill erro em arquivo individual
- **WHEN** um `metadata.json` está corrompido (parse falha)
- **THEN** o script loga o erro com `sourceId`, pula o item e continua processando outros
- **THEN** ao final imprime um relatório com IDs falhados
- **THEN** código de saída é 1 (indicando ao menos uma falha); 0 se todos OK

### Requirement: Backfill idempotente de Conversion e Jobs
The system MUST read legacy `config.json`/`status.json` from `storage/conversions/*/` and upsert them into PostgreSQL `conversions`/`conversion_jobs`.

#### Scenario: Backfill de conversão única
- **WHEN** `pnpm backfill` encontra `storage/conversions/conv_abc/config.json` e `status.json`
- **THEN** lê `config.json` (incluindo `userId`) e faz upsert em `conversions` (`user_id`, `source_id`, `cover`, `output`, `metadata`, `books`, `options`, `error_handling_strategy`, datas)
- **THEN** lê `status.json` agregado (`status`, `progress`, contadores, datas, `error`) e faz `UPDATE conversions SET ...` com snapshot final
- **THEN** para cada item em `status.jobs[]` (ou varredura dos subdiretórios `jobs/{jobId}/`), faz upsert em `conversion_jobs` com estado final
- **THEN** se `outputFile`/`outputSize`/`downloadUrl` existem no status.json do Job, são persistidos

#### Scenario: Job pendente não tem snapshot terminal
- **WHEN** o backfill encontra uma Conversion com Jobs em estado `queued` (não terminal)
- **THEN** persiste com `status='queued'`, `progress=0` no Postgres
- **THEN** o script reporta no relatório final que há Jobs pendentes (o usuário decide se cancela via `POST /api/conversions/:id/cancel` após o backfill)

#### Scenario: Conversão sem userId no `config.json` (legado)
- **WHEN** o backfill encontra um `config.json` antigo sem `userId`
- **THEN** loga warning + pula o item (não é possível atribuir ownership)
- **THEN** relatório final inclui IDs pulados por falta de `userId`

### Requirement: Cleanup de artefatos JSON legados
The system MUST provide a CLI script (`pnpm cleanup:legacy-metadata` e `pnpm cleanup:legacy-status`) that removes legacy JSON files from `storage/` after backfill confirms the data lives in Postgres.

#### Scenario: Cleanup de metadata.json
- **WHEN** `pnpm cleanup:legacy-metadata` é executado após backfill confirmar Source em Postgres
- **THEN** para cada `storage/sources/{sourceId}/metadata.json`, verifica que a linha existe em `sources` (`exists(sourceId)`)
- **THEN** se existir, deleta `metadata.json` e `images.json` (se existir em cada capítulo)
- **THEN** não deleta binários (`*.webp` em `chapters/`, capas em `covers/`)

#### Scenario: Cleanup de status.json e config.json de Conversion/Job
- **WHEN** `pnpm cleanup:legacy-status` é executado após backfill confirmar Conversion/Job em Postgres
- **THEN** para cada `storage/conversions/{conv}/`: deleta `config.json`, `status.json` e `jobs/{jobId}/{config.json, status.json}`
- **THEN** preserva `logs/conversion.log` (auditoria) por padrão
- **THEN** opcional `--purge-logs` deleta os logs também

#### Scenario: Dry-run do cleanup
- **WHEN** `pnpm cleanup:legacy-metadata -- --dry-run` (ou `cleanup:legacy-status --dry-run`)
- **THEN** lista no stdout os arquivos que seriam deletados
- **THEN** **não** deleta nada

#### Scenario: Aborta se Postgres não confirmou
- **WHEN** o cleanup encontra uma fonte/conversion que não existe em Postgres
- **THEN** aborta para este item (não deleta) e loga warning
- **THEN** continua processando outros itens

### Requirement: Documentação operacional
The system MUST provide a documented runbook for the migration, including pre-flight checks, command sequence, rollback steps, and post-migration verification.

#### Scenario: Runbook existente
- **WHEN** um operador precisa fazer a migração em produção
- **THEN** consulta `docs/migracao-json-para-postgres.md`
- **THEN** encontra etapas: 1) parar workers; 2) rodar `pnpm backfill -- --dry-run` e revisar; 3) rodar `pnpm backfill`; 4) validar via `pnpm db:studio`; 5) atualizar `REPO_BACKEND=prisma` no ambiente; 6) restartar workers; 7) opcionalmente rodar cleanup após X dias de observação
- **THEN** inclui rollback: manter `REPO_BACKEND=filesystem` faz o sistema voltar ao estado anterior sem perda (binários e JSONs permanecem até cleanup)

#### Scenario: Documentação em CLAUDE.md
- **WHEN** um novo dev consulta o `CLAUDE.md`
- **THEN** a seção "Variáveis de Ambiente" mostra `REPO_BACKEND` (com note pós-migração: `prisma` recomendado)
- **THEN** existe referência ao runbook `docs/migracao-json-para-postgres.md`