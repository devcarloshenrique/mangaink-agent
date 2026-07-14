## Context

A arquitetura atual em conversão:
- `Conversion` agrega N `ConversionJob` (1 por Book); estado agregado computado por `syncStatus()` que lê todos `status.json` por Job em disco.
- Cada Conversion tem `config.json` imutável (incl. `userId`); cada Job tem `config.json` imutável + `status.json` mutável.
- `CancelConversionUseCase` edita `status.json` dos Jobs diretamente; Worker detecta cancelamento via leitura de `status.json` no loop de download.

As interfaces `ConversionRepository` e `ConversionJobRepository` já abstraem esses acessos. A mudança cria adaptadores Prisma mantendo as interfaces intactas.

## Goals / Non-Goals

**Goals:**
- Criar `PrismaConversionRepository` e `PrismaJobRepository` cobrindo as interfaces.
- Mover persistência de config/estado agregado/status de Job para Postgres em modo Prisma.
- Substituir `syncStatus()` para ler Jobs via Postgres (sem I/O de arquivos).
- Garantir cancel detectável em mid-flight com query leve no DB.
- Manter modo filesystem 100% funcional como fallback.

**Non-Goals:**
- Criar o endpoint `GET /api/conversions` (lista por usuário) — change `add-conversion-library-listing`.
- Mover status hot para Redis — change `add-redis-live-job-status`.
- Migrar binários (EPUBs, imagens) — filesystem.
- Backfill — change `backfill-and-cleanup-legacy-json`.
- Adicionar endpoint de purge — definido como futuro.

## Decisions

### D1. snapshot imutável em JSONB
As colunas `cover`, `output`, `metadata`, `books`, `options`, `chapters` em Conversion e Job são `JSONB` imutáveis pós-criação. O adapter **não** expõe `updateConfig` (somente `update` de status). Snapshot é fiel ao request original (mesmo se source mudar depois).

### D2. syncStatus como UPDATE direto em vez de RMW
Conversão: uma query calcula agregados (`SELECT status, progress FROM conversion_jobs WHERE conversion_id=$1`) → segunda query (`UPDATE conversions SET status=?, progress=?, completed_jobs=?, ...`). Transação curta; otimizada por índice em `(conversion_id)` de `conversion_jobs`.

### D3. Detecção de cancelamento via poll DB (transição)
Enquanto Redis live status não chega (change `add-redis-lida-status`), o worker lê `conversion_jobs.status` a cada capítulo baixado (≈1 query por capítulo, índice PK — barato). Evolução para Redis HSET poll virá na change seguinte; snapshots do status final permanecem em Postgres.

### D4. withConversion() método vaciado
Em Prisma mode, `withConversion(conversionId)` retorna o mesmo adapter (já escopado via FK). Method mantido por compat de interface. Em filesystem mantém path-prefix scoping.

### D5. Endpoint GET /:id atual permanece (não detalha query)
O controller atual chama `findById` na interface; mudanças absorvidas no adapter. Use-case não enxerga diff.

### D6. Cancelamento skipa BullMQ para running jobs
BullMQ não tem suporte limpo para abortar job em execução; o `queue.remove()` apenas tira o job pending da fila. Para running, escrevemos `status='cancelled'` no DB — o worker detecta no próximo poll.

## Risks / Trade-offs

| Risco | Mitigação |
|---|---|
| Poll DB no loop de download adiciona latência | Poll a cada capítulo (não a cada imagem) — baixo custo. Mitigação definitiva: Redis HSET na change seguinte. |
| Transação grande para Conversion com 50+ Jobs | Bulk `createMany` em chunks de 50; transação única para atomicidade |
| Mudar interface sem BC | Interfaces permanecem; adapters apenas são adicionados |
| Especificações de retomada de worker após crash | BullMQ retry já cuida do job state; status no DB é snapshot durável |
| Binários sem cleanup atrelado | Acoplamos binários cleanup a endpoint futuro de purge (não ao `delete` do adapter) |
| `syncStatus` chamado com alta frequência (polling SSE) | Postgres é barato para queries indexadas; a change `add-redis-live-job-status` reduzirá essa carga ao mover hot path para Redis |