## Context

Após as changes 1-5, o backend suporta dois modos (`filesystem` e `prisma`), mas os dados em produção estão todos em JSON. Para ligar `prisma` em produção sem perda, é preciso migrar os artefatos JSON ao Postgres. Backfill é um processo único (uma vez por deploy), idempotente — pode ser re-executado.

Binários (imagens, EPUBs, capas) **não** são migrados — permanecem no disco. Os paths continuam deriváveis a partir dos IDs (`sourceId`/`conversionId`/`jobId`).

## Goals / Non-Goals

**Goals:**
- Backfill idempotente para Sources (metadata.json + images.json).
- Backfill idempotente para Conversions/Jobs (config + status).
- Conj novo de scripts `pnpm backfill`, `pnpm cleanup:legacy-*`.
- Dry-run mode para preview.
- Checkpoint via Redis para retomar.
- Relatório final de sucesso/falha.
- Runbook em docs.

**Non-Goals:**
- Aplicar backfill em CI/CD (processo manual operacional).
- Migrar binários (filesystem permanece).
- Aplicar o cleanup automaticamente (operador decide quando).
- Reverter a flag `REPO_BACKEND` em automático (configuração ambiental).

## Decisions

### D1. Idempotência via upsert por IDs
Todos ops usam `upsert` em campos UNIQUE (`source_id`, `chapter_id`, `cover_id`, `conversion_id`, `job_id`). Re-run sub escreve com último snapshot. Sem produções duplicadas.

### D2. Checkpoint em Redis opcional
`SET backfill:done:{id} 1 EX 86400` marca IDs já processados; TTL de 24h expira automaticamente — se retomar após 24h, reprocessa (idempotente de qualquer forma).

### D3. Dry-run imprime plano
Não toca Redis nem DB; apenas `readdir` + parse + stdout. Útil para estimar volume e validar formatos.

### D4. Cleanup com guarda的存在 em DB
Antes de deletar qualquer JSON, o script verifica `repository.exists(id)` (Source) ou `findById(id) !== null` (Conversion). Aborta para itens sem correspondência em DB.

### D5. Logs preservados por padrão
`logs/conversion.log` pode conter info de auditoria únteis. Cleanup preserva por padrão; uma flag `--purge-logs` permite deletar.

### D6. Binários intocáveis pelo cleanup
Scripts não tentam apagar `*.webp`, capas, EPUBs. Se desejado, isso é tarefa de prune orphans separada (não escopo desta change).

### D7. Ordem de execução recomendada
1. Pause workers de BullMQ (Drain queues).
2. `pnpm backfill -- --dry-run` (validar).
3. `pnpm backfill` (aplicar).
4. Verificar via `pnpm db:studio`.
5. Trocar `REPO_BACKEND=prisma` no deploy.
6. Reiniciar workers.
7. Após N dias de observação: `pnpm cleanup:legacy-metadata` e `pnpm cleanup:legacy-status`.

## Risks / Trade-offs

| Risco | Mitigação |
|---|---|
| Backfill corre enquanto workers continuam ativos | Documentar na runbook: pause workers primeiro |
| JSON corrompido abort uma file | Script loga + pula; relatório final |
| `userId` missing em Conversion config.json antigo | Skip + warning; operador atribuir manualmente via SQL se prévio legado |
| Postgres connection limit durante bulk upserts | Processar em chunks de 50; rate limit |
| Cleanup deleta JSON com dados não em DB | Guarda `exists` antes de apagar; aborta item |
| Redis down no backfill | Checkpoint é best-effort; não bloqueia backfill — apenas reprocessa IDs já feitos (idempotente) |
| Script corre em produção sem dry-run | Documentação clara; default adiciona prompt de `Y/N` se não `--force` |